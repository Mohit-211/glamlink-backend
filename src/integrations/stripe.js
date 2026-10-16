// Stripe for the website and shared billing: stripe-node 23 on API version 2026-09-30.endive, installed as
// `stripe-current`. The app and CRM code still require `stripe` (stripe-node 12, API 2022-11-15) until their
// phases: stripe-node 22+ is a class that needs `new`, and one app file calls it as a function.
const Stripe = require('stripe-current');
const config = require('../core/config/config');

const API_VERSION = '2026-09-30.endive';

let client = null;

const stripe = () => {
    if (!client) {
        client = new Stripe(config.STRIPE_SECRET_KEY || 'sk_test_not_configured', {
            apiVersion: API_VERSION,
            maxNetworkRetries: 2,
            appInfo: { name: 'Glamlink API' },
        });
    }
    return client;
};

module.exports = { stripe, API_VERSION };
