// Glamcoins: rewards earned for app activity, and their rules.
const { earnCoin } = require('./glamcoin.service');

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/user/', router: require('./reward.route') },
    ],
    // For other modules.
    earnCoin,
};
