// Stripe for the website and shared billing: stripe-node 23 on API version 2026-09-30.endive. The app and CRM
// code create their own clients from the same package, pinned to API version 2022-11-15 (the one they were
// written for), until their phases move them here.
const Stripe = require('stripe');
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
