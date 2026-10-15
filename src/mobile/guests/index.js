// Guest sign-in for the app (a device without an account).

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/guest', router: require('./guest.route') },
    ],
};
