// The account owner's own data: profile, settings, signed-in addresses, account deletion.

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/user/', router: require('./user.route') },
        { path: '/order', router: require('./address.route') },
    ],
};
