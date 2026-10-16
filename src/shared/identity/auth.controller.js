const httpStatus = require('../../core/http/status');
const catchAsync = require('../../core/http/catchAsync');
const ApiError = require('../../core/http/ApiError');
const responseWrapper = require('../../core/http/responseWrapper');
const httpClient = require('../../core/http/httpClient');
const logger = require('../../core/logger');
const authService = require('./auth.service');
const { logRegisterAttempt } = require('./registerLogger');
const config = require('../../core/config/config');

// The website keeps its refresh token in an httpOnly cookie on the API's host (api.glamlink.net, same site
// as glamlink.net), out of reach of page scripts; the app receives it in the response body.
const REFRESH_COOKIE = 'glamlink_refresh';
const cookieOptions = () => ({
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax',
    path: '/api/v1/user/auth',
});
const readCookie = (req, name) => {
    for (const part of (req.headers.cookie || '').split(';')) {
        const [key, ...value] = part.trim().split('=');
        if (key === name) return decodeURIComponent(value.join('='));
    }
    return null;
};
// Website: the refresh token goes into the cookie and out of the body.
const deliver = (res, result, client) => {
    if (client !== 'website' || !result.refresh_token) return result;
    const { refresh_token, ...rest } = result;
    res.cookie(REFRESH_COOKIE, refresh_token, { ...cookieOptions(), expires: new Date(result.refresh_token_expires_at) });
    return rest;
};

// Which client is calling: the website signs in professionals only.
const contextOf = (req) => {
    const client = req.body.client || req.headers['x-client'];
    return {
        client: client === 'website' ? 'website' : 'app',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timezone: req.headers.timezone,
        pushToken: req.body.fcm_token || req.headers.fcm_token,
    };
};

// Cloudflare Turnstile on registration. Production refuses sign-ups while TURNSTILE_SECRET_KEY is missing, rather
// than letting bots through; elsewhere the check is skipped without it.
const verifyCaptcha = async (req) => {
    if (!process.env.TURNSTILE_SECRET_KEY) {
        if (config.env !== 'production') return;
        logger.error('Sign-up refused: TURNSTILE_SECRET_KEY is not set.');
        throw ApiError.withCode(httpStatus.SERVICE_UNAVAILABLE, 'Sign-up is not available right now. Please try again later.', 'CAPTCHA_NOT_CONFIGURED');
    }
    const token = req.body.turnstile_token;
    if (!token) throw ApiError.withCode(httpStatus.BAD_REQUEST, 'Captcha token is required', 'CAPTCHA_REQUIRED');
    let passed = false;
    try {
        const res = await httpClient.post(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY, response: token, remoteip: req.ip }),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10000 },
        );
        passed = Boolean(res.data.success);
    } catch (error) {
        logger.warn('Captcha verification request failed:', error.message);
    }
    if (!passed) throw ApiError.withCode(httpStatus.BAD_REQUEST, 'Captcha verification failed', 'CAPTCHA_FAILED');
};

const register = catchAsync(async (req, res) => {
    logRegisterAttempt({
        ip: req.ip,
        userAgent: req.headers['user-agent'] || 'unknown',
        role_id: req.body.account_type || '',
        email: req.body.email || '',
        name: req.body.name || '',
    });
    await verifyCaptcha(req);
    const result = await authService.register(req.body, req.files, contextOf(req));
    return responseWrapper(res, result, 'Please check your email for a link to verify your account.', httpStatus.CREATED);
});

const verifyEmail = catchAsync(async (req, res) => {
    const context = contextOf(req);
    const result = await authService.verifyEmail(req.body.token, context);
    return responseWrapper(res, deliver(res, result, context.client), 'Your email is verified.');
});

const resendVerification = catchAsync(async (req, res) => {
    await authService.resendVerification(req.body.email);
    return responseWrapper(res, {}, 'If that account needs verifying, we have sent a new link.');
});

const login = catchAsync(async (req, res) => {
    const context = contextOf(req);
    const result = await authService.login(req.body, context);
    return responseWrapper(res, deliver(res, result, context.client), 'Signed in.');
});

const refresh = catchAsync(async (req, res) => {
    const fromCookie = !req.body.refresh_token;
    const tokens = await authService.refresh(req.body.refresh_token || readCookie(req, REFRESH_COOKIE));
    return responseWrapper(res, deliver(res, tokens, fromCookie ? 'website' : 'app'), 'Session refreshed.');
});

const logout = catchAsync(async (req, res) => {
    await authService.logout(req.session, contextOf(req));
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    return responseWrapper(res, {}, 'Signed out.');
});

const logoutEverywhere = catchAsync(async (req, res) => {
    await authService.logoutEverywhere(req.user);
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    return responseWrapper(res, {}, 'Signed out on every device.');
});

const forgotPassword = catchAsync(async (req, res) => {
    await authService.forgotPassword(req.body.email);
    return responseWrapper(res, {}, 'If an account uses that email, we have sent a link to reset the password.');
});

const resetPassword = catchAsync(async (req, res) => {
    await authService.resetPassword(req.body);
    return responseWrapper(res, {}, 'Your password is updated. Please sign in.');
});

const changePassword = catchAsync(async (req, res) => {
    await authService.changePassword(req.user, req.session, req.body);
    return responseWrapper(res, {}, 'Your password is updated. Other devices have been signed out.');
});

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
