// Payments: Stripe keys and customers, the payment webhook (with the handlers products register), payment totals.
const { getKeys, getCustomer } = require('./stripeCustomer.service');
const { registerStripeHandlers } = require('./stripeHandlers');

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/payment', router: require('./payment.route') },
    ],
    // For other modules.
    getKeys,
    getCustomer,
    registerStripeHandlers,
};
