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

// The account the secret key belongs to, as the server's scripts name it: its dashboard name and id.
const accountName = async () => {
    const account = await stripe().accounts.retrieve();
    const name = account.settings?.dashboard?.display_name || account.business_profile?.name;
    return name ? `${name} (${account.id})` : account.id;
};

module.exports = { stripe, API_VERSION, accountName };
