// Paid promotion of a professional's services and keywords.

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/user/', router: require('./promotionRequest.route') },
        { path: '/promotion', router: require('./promotion.route') },
    ],
    // Daily at 00:01: promotions that ended are switched off.
    jobs: () => {
        const { updateUserPromotions } = require('./promotion.service');
        return [{ name: 'promotions-expiry', schedule: '1 0 * * *', run: async () => { await updateUserPromotions(); } }];
    },
};
