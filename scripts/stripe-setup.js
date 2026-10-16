#!/usr/bin/env node
/**
 * Sets up Stripe for the Access purchases (docs/access.md section 6), with the keys in .env (test or live):
 * the Stripe products Access Pro, NFC keychain and Shipping and their list prices. The old purchase flow's prices
 * in .env (STRIPE_GLAMLINK_MONTHLY_PRICE_ID, STRIPE_GLAMLINK_SETUP_PRICE_ID, STRIPE_SHIPPING_PRICE_ID) are adopted
 * when they still match. Safe to run again. Then prints the webhook endpoint to create.
 *
 *   node scripts/stripe-setup.js
 */
process.loadEnvFile(require('path').join(__dirname, '..', '.env'));
const config = require('../src/core/config/config');
const { API_VERSION } = require('../src/integrations/stripe');
const { AccessProduct } = require('../src/models');
const { ensureStripeProduct, ensureListPrice } = require('../src/website/access-card/stripeCatalog');
const sequelize = require('../src/core/db/central.db');

const EVENTS = [
    'invoice.paid',
    'invoice.payment_failed',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'charge.succeeded',
];

(async () => {
    const mode = String(config.STRIPE_SECRET_KEY || '').startsWith('sk_live') ? 'LIVE' : 'test';
    console.log(`Stripe (${mode} keys), API version ${API_VERSION}\n`);
    for (const product of await AccessProduct.findAll({ order: [['id', 'ASC']] })) {
        const productId = await ensureStripeProduct(product);
        const priceId = product.code === 'shipping' ? '(amount per order)' : await ensureListPrice(product);
        console.log(`${product.code.padEnd(9)} ${String(product.amount_cents).padStart(5)}¢  product ${productId}  price ${priceId}`);
    }
    console.log(`
Webhook endpoint (Workbench > Webhooks, or the API), on API version ${API_VERSION}:
  ${config.API_BASE_URL}/api/v1/payment/stripe/charge-intent/webhooks
  events: ${EVENTS.join(', ')}
Put its signing secret in .env as STRIPE_WEBHOOK_SECRET_INTENT_CHARGE.`);
    await sequelize.close();
})().catch(async (err) => {
    console.error(err.message);
    await sequelize.close();
    process.exit(1);
});
