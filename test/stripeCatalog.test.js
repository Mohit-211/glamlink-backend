// The Stripe side of the catalog (website/access-card/stripeCatalog.js): the old flow's prices in .env, adopted when
// Stripe has them and skipped when it doesn't (the test server, Nov 4: a price id from another account stopped
// npm run stripe:setup). Stripe is faked (test/fakeStripe.js); the products are plain objects, not rows.
const { installFakeStripe } = require('./fakeStripe');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');

let stripe, catalog, config, legacy;

before(() => {
    stripe = installFakeStripe();
    config = require('../src/core/config/config');
    catalog = require('../src/website/access-card/stripeCatalog');
    legacy = config.STRIPE_LEGACY_PRICES;
});

after(() => {
    config.STRIPE_LEGACY_PRICES = legacy;
});

// What ensureStripeProduct and ensureListPrice read and write of an AccessProduct row.
const product = (fields) => {
    const row = { code: 'pro', name: 'Access Pro', kind: 'subscription', currency: 'usd', amount_cents: 999, billing_interval: 'month', stripe_product_id: null, stripe_price_id: null, ...fields };
    row.update = async (changes) => Object.assign(row, changes);
    return row;
};

test('an old price this Stripe account has no record of is skipped: the product is found or made instead', async () => {
    config.STRIPE_LEGACY_PRICES = { pro: 'price_from_another_account' };
    const retrieve = stripe.client.prices.retrieve;
    stripe.client.prices.retrieve = async (id) => {
        throw stripe.stripeError(`No such price: '${id}'`, { statusCode: 404, code: 'resource_missing' });
    };
    try {
        const pro = product();
        const priceId = await catalog.ensureListPrice(pro);
        assert.match(pro.stripe_product_id, /^prod_/);
        assert.equal(priceId, pro.stripe_price_id);
        const made = stripe.state.prices[priceId];
        assert.equal(made.unit_amount, 999);
        assert.equal(made.product, pro.stripe_product_id);
    } finally {
        stripe.client.prices.retrieve = retrieve;
    }
});

test('any other Stripe error still stops it', async () => {
    config.STRIPE_LEGACY_PRICES = { pro: 'price_legacy' };
    const retrieve = stripe.client.prices.retrieve;
    stripe.client.prices.retrieve = async () => {
        throw stripe.stripeError('Invalid API Key provided', { type: 'StripeAuthenticationError', statusCode: 401 });
    };
    try {
        await assert.rejects(catalog.ensureStripeProduct(product()), /Invalid API Key/);
    } finally {
        stripe.client.prices.retrieve = retrieve;
    }
});

test('an old price Stripe has is still adopted', async () => {
    config.STRIPE_LEGACY_PRICES = { pro: 'price_legacy' };
    const pro = product({ amount_cents: 499 });
    assert.equal(await catalog.ensureStripeProduct(pro), 'prod_legacy');
    // The fake's old price is $4.99 a month: it matches, so it is the list price too
    assert.equal(pro.stripe_price_id, 'price_legacy');
});
