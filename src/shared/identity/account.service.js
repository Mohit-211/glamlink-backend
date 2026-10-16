// Creating accounts, the one place that does it: website and app registration, and Access card checkout
// for someone without an account. Keeps role_id in step with the account type while code still reads it.
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const config = require('../../core/config/config');
const sequelize = require('../../core/db/central.db');
const { User, Profile, UserAttachment, BusinessCard } = require('../../models');
const { issueEmailToken } = require('./emailToken.service');

const ACCOUNT_TYPES = ['user', 'professional'];
const PROFESSIONAL_TYPES = ['individual', 'brand'];

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const roleIdFor = (accountType, professionalType) => {
    if (accountType === 'user') return Number(config.USR_ROLE_ID);
    return Number(professionalType === 'brand' ? config.BRND_ROLE_ID : config.PROFESSIONAL_ROLE_ID);
};

const hashPassword = (password) => bcrypt.hash(password, 10);

// A free user_name from a name ("Jane Doe" -> "janedoe", then "janedoe1", ...).
const uniqueUserName = async (base, transaction) => {
    const stem = String(base || '').trim().toLowerCase().replace(/[^a-z0-9._]/g, '') || 'user';
    let candidate = stem;
    for (let n = 1; await User.findOne({ where: { user_name: candidate }, attributes: ['id'], paranoid: false, transaction }); n++) {
        candidate = `${stem}${n}`;
    }
    return candidate;
};

// Creates the account and its profile. `password` may be omitted (the person sets one from an email link).
const createAccount = async ({
    email, name, password, accountType = 'professional', professionalType = 'individual', verified = false,
    userName, mobile, about, profession, address, stateId, cityId, latitude, longitude, referredBy, photos = [],
}) => {
    const type = ACCOUNT_TYPES.includes(accountType) ? accountType : 'professional';
    const proType = type === 'professional' ? (PROFESSIONAL_TYPES.includes(professionalType) ? professionalType : 'individual') : null;
    const passwordHash = password ? await hashPassword(password) : null;

    return sequelize.transaction(async (transaction) => {
        const user = await User.create({
            email: normalizeEmail(email),
            user_name: await uniqueUserName(userName || name, transaction),
            password: passwordHash,
            role_id: roleIdFor(type, proType),
            account_type: type,
            professional_type: proType,
            status: verified ? 'ACCEPTED' : 'PENDING',
            email_verified_at: verified ? new Date() : null,
            latitude: latitude || null,
            longitude: longitude || null,
            referred_by: referredBy || null,
        }, { transaction });

        await Profile.create({
            user_id: user.id,
            email: user.email,
            name,
            mobile: mobile || null,
            about: about || null,
            address: address || null,
            state_id: stateId || null,
            city_id: cityId || null,
            // Empty unless the person gave one (it used to default to "Esthetician" for every professional).
            profession: profession || null,
        }, { transaction });

        for (const photo of photos) {
            await UserAttachment.create({
                role_id: user.role_id,
                user_id: user.id,
                title: 'Profile Image',
                file_type: 'Image',
                file_name: photo.filename,
                file_uri: '/images',
                file_size: photo.size,
            }, { transaction });
        }
        return user;
    });
};

// The account an Access card bought with this email belongs to. An existing live account is used (a user
// account becomes a professional one: buying an Access card is that switch); otherwise a professional
// account without a password is created, and the person sets one from the welcome email (setPasswordLink).
// `extra` is set on a new account only. Returns { user, created }.
const accessCardOwner = async ({ email, name, phone, extra = {} }) => {
    const existing = await User.findOne({ where: { email: normalizeEmail(email) } });
    if (existing) {
        if (existing.account_type === 'user') {
            await existing.update({ account_type: 'professional', professional_type: 'individual', role_id: roleIdFor('professional', 'individual'), downgraded_at: null });
        }
        return { user: existing, created: false };
    }
    const user = await createAccount({ email, name, mobile: phone, accountType: 'professional' });
    if (Object.keys(extra).length) await user.update(extra);
    return { user, created: true };
};

// Link for a new Access card owner to set their first password (the reset page; it also verifies the email).
const setPasswordLink = async (user) => {
    const token = await issueEmailToken(user.id, 'reset_password', { hours: 7 * 24 });
    return `${config.WEBSITE_URL}/reset-password?token=${encodeURIComponent(token)}`;
};

// An Access card bought while signed out carries only an email; it is attached once that email is proven. Drafts
// are not (a guest's unpaid card is claimed by signing in), and a person has one card: the newest, only when they
// have none.
const attachGuestBusinessCards = async (user) => {
    if (await BusinessCard.findOne({ where: { user_id: user.id }, attributes: ['id'] })) return;
    const card = await BusinessCard.findOne({
        where: { email: user.email, user_id: null, is_active: true, status: { [Op.ne]: 'draft' } },
        order: [['id', 'DESC']],
    });
    if (card) await card.update({ user_id: user.id });
};

// What the website and app get back about the signed-in account.
const accountView = (user, profile) => ({
    id: user.id,
    name: profile?.name ?? user.user_profile?.name ?? null,
    email: user.email,
    account_type: user.account_type,
    professional_type: user.professional_type,
    email_verified: Boolean(user.email_verified_at),
    role_id: user.role_id,
});

module.exports = {
    normalizeEmail,
    hashPassword,
    roleIdFor,
    uniqueUserName,
    createAccount,
    accessCardOwner,
    setPasswordLink,
    attachGuestBusinessCards,
    accountView,
};
