// Accounts and sign-in: registration, email links, sessions, and who is calling.
const { authenticate, optionalAuth, requireProfessional, identify } = require('./authenticate');
const { createSession, revokeUserSessions, tokenFromRequest } = require('./sessions');
const { normalizeEmail, createAccount, accessCardOwner, setPasswordLink } = require('./account.service');
const { mergeDuplicateAccounts } = require('./accountMerge');

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/user/auth/', router: require('./auth.route') },
    ],
    // For other modules and data migrations.
    authenticate,
    optionalAuth,
    requireProfessional,
    identify,
    createSession,
    revokeUserSessions,
    tokenFromRequest,
    normalizeEmail,
    createAccount,
    accessCardOwner,
    setPasswordLink,
    mergeDuplicateAccounts,
};
