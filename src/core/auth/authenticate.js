// Who is calling, from the access token (see sessions.js).
//   authenticate          a signed-in account is required: 401 otherwise
//   optionalAuth          signed in or not (public pages that show more to a signed-in user)
//   requireProfessional   a signed-in professional account: 403 for user accounts
// Each sets req.user and req.session, and req.body.user / req.isGuest where the existing handlers read them.
const catchAsync = require('../http/catchAsync');
const ApiError = require('../http/ApiError');
const httpStatus = require('../http/status');
const { sessionForAccessToken, tokenFromRequest } = require('./sessions');
const { loadRequestUser } = require('./requestUser');

const signedOut = () => ApiError.withCode(httpStatus.UNAUTHORIZED, 'Please sign in again.', 'SESSION_EXPIRED');

const setGuest = (req) => {
    req.user = null;
    req.session = null;
    req.isGuest = true;
    req.body.user = null;
};

// Resolves the caller. No token: guest. A token that is invalid, expired or signed out: 401.
const identify = async (req) => {
    const token = tokenFromRequest(req);
    if (!token) return setGuest(req);
    const session = await sessionForAccessToken(token);
    if (!session) throw signedOut();
    const user = await loadRequestUser(session.user_id);
    if (!user) throw signedOut();
    req.user = user;
    req.session = session;
    req.isGuest = false;
    req.body.user = user;
    req.body.ip_address = req.ip;
};

const optionalAuth = catchAsync(async (req, res, next) => {
    await identify(req);
    next();
});

const authenticate = catchAsync(async (req, res, next) => {
    await identify(req);
    if (!req.user) throw ApiError.withCode(httpStatus.UNAUTHORIZED, 'Please sign in.', 'SIGN_IN_REQUIRED');
    next();
});

const requireProfessional = catchAsync(async (req, res, next) => {
    await identify(req);
    if (!req.user) throw ApiError.withCode(httpStatus.UNAUTHORIZED, 'Please sign in.', 'SIGN_IN_REQUIRED');
    if (req.user.account_type !== 'professional') {
        throw ApiError.withCode(httpStatus.FORBIDDEN, 'This needs a professional account.', 'PROFESSIONAL_REQUIRED');
    }
    next();
});

module.exports = { authenticate, optionalAuth, requireProfessional, identify };
