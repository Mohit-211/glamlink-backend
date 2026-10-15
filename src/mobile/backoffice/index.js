// Admin screens over app data: moderation, promotions, glamcoin rules, referrals, user activity, dashboards.

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/admin/', router: require('./backoffice.route') },
        { path: '/admin/dashboard', router: require('./dashboard.route') },
    ],
};
