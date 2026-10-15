// Admin accounts and sign-in, roles, departments, permissions, user management, and the admin guards.
const { requireAdmin, requireUser, requireOwnerOrAdmin } = require('./access.middleware');
const { validateJWTtoken } = require('./adminToken.middleware');

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/admin/auth/', router: require('./adminAuth.route') },
        { path: '/admin/', router: require('./admin.route') },
        { path: '/role', router: require('./role.route') },
        { path: '/department', router: require('./department.route') },
    ],
    // For other modules.
    requireAdmin,
    requireUser,
    requireOwnerOrAdmin,
    validateJWTtoken,
};
