#!/usr/bin/env node
/**
 * Sets up Stripe for the Access purchases (docs/access.md section 6), with the keys in .env (test or live):
 * the Stripe products Access Pro, NFC keychain and Shipping and their list prices. The old purchase flow's prices
 * in .env (STRIPE_GLAMLINK_MONTHLY_PRICE_ID, STRIPE_GLAMLINK_SETUP_PRICE_ID, STRIPE_SHIPPING_PRICE_ID) are adopted
 * when they still match. Ids saved with other keys (the test ones, after the switch to live keys) are made again.
 * Safe to run again. Then prints the webhook endpoint to create.
 *
 *   node scripts/stripe-setup.js
 */
process.loadEnvFile(require('path').join(__dirname, '..', '.env'));
const config = require('../src/core/config/config');
const { API_VERSION, accountName } = require('../src/integrations/stripe');
const { AccessProduct, AccessDiscount } = require('../src/models');
const { ensureStripeProduct, ensureListPrice, forgetForeignIds } = require('../src/website/access-card/stripeCatalog');
const sequelize = require('../src/core/db/central.db');

// The events the webhook endpoint must send: every one the Access handlers take (website/access-card/payments.js),
// charge.succeeded among them (the app's payments too).
const EVENTS = Object.keys(require('../src/website/access-card').stripeHandlers());

(async () => {
    const mode = String(config.STRIPE_SECRET_KEY || '').startsWith('sk_live') ? 'LIVE' : 'test';
    console.log(`Stripe (${mode} keys, account ${await accountName()}), API version ${API_VERSION}\n`);
    const products = await AccessProduct.findAll({ order: [['id', 'ASC']] });
    const forgotten = await forgetForeignIds({ products, discounts: await AccessDiscount.findAll() });
    if (forgotten.length) console.log(`Not in this Stripe account (saved with other keys), so made again or adopted:\n  ${forgotten.join('\n  ')}\n`);
    for (const product of products) {
        const productId = await ensureStripeProduct(product);
        const priceId = product.code === 'shipping' ? '(amount per order)' : await ensureListPrice(product);
        console.log(`${product.code.padEnd(9)} ${String(product.amount_cents).padStart(5)}¢  product ${productId}  price ${priceId}`);
    }
    console.log(`
Next, the webhook endpoint: npm run stripe:webhook makes it on API version ${API_VERSION} and puts its signing
secret in .env (STRIPE_WEBHOOK_SECRET_INTENT_CHARGE). By hand instead (Workbench > Webhooks), on that version:
  ${config.API_BASE_URL}/api/v1/payment/stripe/charge-intent/webhooks
  events: ${EVENTS.join(', ')}`);
    await sequelize.close();
})().catch(async (err) => {
    console.error(err.message);
    await sequelize.close();
    process.exit(1);
});
