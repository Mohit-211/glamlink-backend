// Access cards: cards and their public pages, plans and subscriptions, NFC orders, the logged-out purchase addresses, analytics, the directory.

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/businessCard', router: require('./businessCard.route') },
        { path: '/order', router: require('./cardAddress.route') },
        { path: '/access-card/analytics', router: require('./accessCardAnalytics.route') },
    ],
};
