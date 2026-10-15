// Sign-up, sign-in and password flows for users and professionals (admins sign in separately).
// Email addresses are verified by a link, passwords reset by a link; sessions come from core/auth/sessions.
//
// `context` is { client: 'website' | 'app', ip, userAgent, timezone, pushToken }. The website signs in
// professionals only.
const bcrypt = require('bcryptjs');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const config = require('../../core/config/config');
const validateEmail = require('../../core/utils/validateEmail');
const validatePassword = require('../../core/utils/validatePassword');
const { DateTime } = require('../../core/utils/time');
const { createSession, refreshSession, revokeSession, revokeUserSessions } = require('./sessions');
const { User, Profile, UserLoginTiming, Timezone } = require('../../models');
const { sendVerifyEmailLink, sendResetPasswordLink, sendOTPMails } = require('../../integrations/mailer/email.service');
const { issueEmailToken, consumeEmailToken } = require('./emailToken.service');
const { normalizeEmail, hashPassword, createAccount, attachGuestBusinessCards, accountView } = require('./account.service');

const PASSWORD_RULES = 'Password must be 8–100 characters with at least 2 digits and no spaces.';

const fail = (status, message, code) => ApiError.withCode(status, message, code);
const invalidLink = () => fail(httpStatus.BAD_REQUEST, 'This link has expired or was already used. Please ask for a new one.', 'INVALID_LINK');

const link = (path, token) => `${config.WEBSITE_URL}${path}?token=${encodeURIComponent(token)}`;

const sendVerification = async (user, name) => {
    const token = await issueEmailToken(user.id, 'verify_email');
    await sendVerifyEmailLink({ to: user.email, name, link: link('/verify-email', token) });
};

const recordLogin = async (user, session, timezone) => {
    try {
        const at = new Date();
        const zone = timezone ? await Timezone.findOne({ where: { time_zone: timezone, is_active: true } }) : null;
        await UserLoginTiming.create({
            user_id: user.id,
            role_id: user.role_id,
            session_id: session.id,
            login_time_utc: at,
            login_time_local: DateTime.fromJSDate(at).setZone(timezone || 'UTC').toFormat('yyyy-MM-dd HH:mm:ss'),
            time_zone: zone ? zone.id : null,
        });
    } catch {
        // Login history is informational: never block a sign-in on it.
    }
};

const recordLogout = async (session, timezone) => {
    try {
        const at = new Date();
        await UserLoginTiming.update(
            { logout_time_utc: at, logout_time_local: DateTime.fromJSDate(at).setZone(timezone || 'UTC').toFormat('yyyy-MM-dd HH:mm:ss') },
            { where: { session_id: session.id } },
        );
    } catch {
        // informational, as above
    }
};

const signIn = async (user, context) => {
    const { session, tokens } = await createSession(user, context);
    await recordLogin(user, session, context.timezone);
    const profile = await Profile.findOne({ where: { user_id: user.id }, attributes: ['name'] });
    return { user: accountView(user, profile), ...tokens };
};

// --- registration and verification ---------------------------------------------------------------

const register = async (body, files, context) => {
    const email = normalizeEmail(body.email);
    const name = String(body.name || '').trim();
    if (!name || !validateEmail(email)) throw fail(httpStatus.BAD_REQUEST, 'Please enter your name and a valid email.', 'INVALID_INPUT');
    if (!validatePassword(body.password)) throw fail(httpStatus.BAD_REQUEST, PASSWORD_RULES, 'WEAK_PASSWORD');
    if (body.password !== body.confirm_password) throw fail(httpStatus.BAD_REQUEST, 'Password and confirm password must match.', 'PASSWORD_MISMATCH');

    // The website registers professionals; the app may register either type.
    const accountType = context.client === 'website' ? 'professional' : body.account_type || 'professional';
    if (!['user', 'professional'].includes(accountType)) throw fail(httpStatus.BAD_REQUEST, 'Unknown account type.', 'INVALID_INPUT');

    const existing = await User.findOne({ where: { email } });
    if (existing) {
        if (existing.email_verified_at) {
            throw fail(httpStatus.CONFLICT, 'An account with this email already exists. Please sign in or reset your password.', 'EMAIL_TAKEN');
        }
        // Signed up before but never verified: send a fresh link instead of a second account.
        const profile = await Profile.findOne({ where: { user_id: existing.id }, attributes: ['name'] });
        await sendVerification(existing, profile?.name);
        return { email, verification_sent: true };
    }

    let referredBy = null;
    if (body.referral_code) {
        const referrer = await User.findOne({ where: { referral_code: body.referral_code } });
        if (referrer) {
            referredBy = referrer.id;
            await referrer.increment('referral_count');
        }
    }

    const present = (v) => (v && v !== 'undefined' ? v : undefined);
    const user = await createAccount({
        email,
        name,
        password: body.password,
        accountType,
        professionalType: body.professional_type,
        userName: present(body.user_name),
        mobile: present(body.mobile),
        about: present(body.about),
        profession: present(body.profession),
        address: present(body.address),
        stateId: present(body.state_id),
        cityId: present(body.city_id),
        latitude: present(body.latitude),
        longitude: present(body.longitude),
        referredBy,
        photos: files?.images || [],
    });
    await sendVerification(user, name);
    return { email, verification_sent: true };
};

// From the link in the verification email. Signs the person in.
const verifyEmail = async (token, context) => {
    const userId = await consumeEmailToken(token, 'verify_email');
    if (!userId) throw invalidLink();
    const user = await User.findOne({ where: { id: userId } });
    if (!user) throw invalidLink();
    if (!user.email_verified_at) {
        await user.update({ email_verified_at: new Date(), status: 'ACCEPTED' });
        await attachGuestBusinessCards(user);
        sendOTPMails(user.email).catch(() => {});
    }
    return signIn(user, context);
};

// Always answers the same way, so the form cannot be used to find out which emails have accounts.
const resendVerification = async (email) => {
    const user = await User.findOne({ where: { email: normalizeEmail(email) } });
    if (user && !user.email_verified_at && user.is_active) {
        const profile = await Profile.findOne({ where: { user_id: user.id }, attributes: ['name'] });
        await sendVerification(user, profile?.name);
    }
    return {};
};

// --- signing in and out --------------------------------------------------------------------------

const login = async ({ email, password }, context) => {
    const invalid = () => fail(httpStatus.UNAUTHORIZED, 'Invalid email or password.', 'INVALID_CREDENTIALS');
    if (!email || !password) throw invalid();
    const user = await User.findOne({ where: { email: normalizeEmail(email) } });
    if (!user) throw invalid();
    if (!user.password) {
        throw fail(httpStatus.BAD_REQUEST, 'This account has no password yet (it was created with Google or Apple sign-in). Use "Forgot password" to set one.', 'PASSWORD_NOT_SET');
    }
    if (!(await bcrypt.compare(String(password), user.password))) throw invalid();

    if (!user.is_active || user.status === 'REJECTED') throw fail(httpStatus.FORBIDDEN, 'This account is disabled. Please contact support@glamlink.net.', 'ACCOUNT_DISABLED');
    if (user.account_type === 'staff') throw fail(httpStatus.FORBIDDEN, 'Staff accounts cannot sign in here.', 'ACCOUNT_NOT_SUPPORTED');
    if (context.client === 'website' && user.account_type !== 'professional') {
        throw fail(httpStatus.FORBIDDEN, 'The website is for professional accounts. Switch your account to professional in the Glamlink app to sign in here.', 'PROFESSIONAL_REQUIRED');
    }
    if (!user.email_verified_at) {
        const profile = await Profile.findOne({ where: { user_id: user.id }, attributes: ['name'] });
        await sendVerification(user, profile?.name);
        throw fail(httpStatus.FORBIDDEN, 'Please verify your email first. We have sent you a new link.', 'EMAIL_NOT_VERIFIED');
    }
    return signIn(user, context);
};

const refresh = async (refreshToken) => {
    const { tokens } = await refreshSession(refreshToken);
    return tokens;
};

const logout = async (session, context) => {
    await revokeSession(session.id, 'signed_out');
    await recordLogout(session, context.timezone);
    return {};
};

const logoutEverywhere = async (user) => {
    await revokeUserSessions(user.id, 'signed_out_everywhere');
    return {};
};

// --- passwords -----------------------------------------------------------------------------------

// Always answers the same way (see resendVerification). Also how Google/Apple-only accounts set a password.
const forgotPassword = async (email) => {
    const user = await User.findOne({ where: { email: normalizeEmail(email) } });
    if (user && user.is_active && user.account_type !== 'staff') {
        const token = await issueEmailToken(user.id, 'reset_password');
        const profile = await Profile.findOne({ where: { user_id: user.id }, attributes: ['name'] });
        await sendResetPasswordLink({ to: user.email, name: profile?.name, link: link('/reset-password', token) });
    }
    return {};
};

// From the link in the reset email (or the welcome email of an Access card bought while signed out).
// Signs out every device.
const resetPassword = async ({ token, password, confirm_password }) => {
    if (!validatePassword(password)) throw fail(httpStatus.BAD_REQUEST, PASSWORD_RULES, 'WEAK_PASSWORD');
    if (password !== confirm_password) throw fail(httpStatus.BAD_REQUEST, 'Password and confirm password must match.', 'PASSWORD_MISMATCH');
    const userId = await consumeEmailToken(token, 'reset_password');
    if (!userId) throw invalidLink();
    const user = await User.findOne({ where: { id: userId } });
    if (!user) throw invalidLink();
    // The link came to this inbox, so the address is proven too.
    const verify = user.email_verified_at ? {} : { email_verified_at: new Date(), status: 'ACCEPTED' };
    await user.update({ password: await hashPassword(password), ...verify });
    if (verify.email_verified_at) await attachGuestBusinessCards(user);
    await revokeUserSessions(user.id, 'password_reset');
    return {};
};

// Signed in, knowing the current password. Other devices are signed out.
const changePassword = async (user, session, { old_password, new_password, confirm_password }) => {
    const account = await User.findOne({ where: { id: user.id } });
    if (!account.password) throw fail(httpStatus.BAD_REQUEST, 'This account has no password yet. Use "Forgot password" to set one.', 'PASSWORD_NOT_SET');
    if (!(await bcrypt.compare(String(old_password || ''), account.password))) {
        throw fail(httpStatus.BAD_REQUEST, 'Your current password is incorrect.', 'INVALID_CREDENTIALS');
    }
    if (!validatePassword(new_password)) throw fail(httpStatus.BAD_REQUEST, PASSWORD_RULES, 'WEAK_PASSWORD');
    if (new_password !== confirm_password) throw fail(httpStatus.BAD_REQUEST, 'Password and confirm password must match.', 'PASSWORD_MISMATCH');
    await account.update({ password: await hashPassword(new_password) });
    await revokeUserSessions(account.id, 'password_changed', { except: session.id });
    return {};
};

module.exports = {
    register,
    verifyEmail,
    resendVerification,
    login,
    refresh,
    logout,
    logoutEverywhere,
    forgotPassword,
    resetPassword,
    changePassword,
};
