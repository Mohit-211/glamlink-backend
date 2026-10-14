const httpStatus = require('../../core/http/status');
const catchAsync = require('../../core/http/catchAsync');
const ApiError = require('../../core/http/ApiError');
const responseWrapper = require('../../core/http/responseWrapper');
const httpClient = require('../../core/http/httpClient');
const logger = require('../../core/logger');
const authService = require('./auth.service');
const { logRegisterAttempt } = require('./registerLogger');

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

// Cloudflare Turnstile on registration, when TURNSTILE_SECRET_KEY is set.
const verifyCaptcha = async (req) => {
    if (!process.env.TURNSTILE_SECRET_KEY) return;
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
    const result = await authService.verifyEmail(req.body.token, contextOf(req));
    return responseWrapper(res, result, 'Your email is verified.');
});

const resendVerification = catchAsync(async (req, res) => {
    await authService.resendVerification(req.body.email);
    return responseWrapper(res, {}, 'If that account needs verifying, we have sent a new link.');
});

const login = catchAsync(async (req, res) => {
    const result = await authService.login(req.body, contextOf(req));
    return responseWrapper(res, result, 'Signed in.');
});

const refresh = catchAsync(async (req, res) => {
    const tokens = await authService.refresh(req.body.refresh_token);
    return responseWrapper(res, tokens, 'Session refreshed.');
});

const logout = catchAsync(async (req, res) => {
    await authService.logout(req.session, contextOf(req));
    return responseWrapper(res, {}, 'Signed out.');
});

const logoutEverywhere = catchAsync(async (req, res) => {
    await authService.logoutEverywhere(req.user);
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
