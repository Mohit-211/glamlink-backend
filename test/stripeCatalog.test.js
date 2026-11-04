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

// The switch to live keys (Nov 5) kept the database the test keys had filled in: npm run stripe:setup forgets the ids
// the live account doesn't have, so the products are adopted or made again instead of failing every checkout.
const withStripeObjects = async (known, run) => {
    const { products, prices, coupons } = stripe.client;
    const saved = [products.retrieve, prices.retrieve, coupons.retrieve];
    const retrieve = (what) => async (id) => {
        if (known[id]) return known[id];
        throw stripe.stripeError(`No such ${what}: '${id}'`, { statusCode: 404, code: 'resource_missing' });
    };
    [products.retrieve, prices.retrieve, coupons.retrieve] = [retrieve('product'), retrieve('price'), retrieve('coupon')];
    try {
        await run();
    } finally {
        [products.retrieve, prices.retrieve, coupons.retrieve] = saved;
    }
};

test('ids saved with other keys, and an archived price, are forgotten; the rest are kept', async () => {
    config.STRIPE_LEGACY_PRICES = {};
    const known = { prod_live: { id: 'prod_live' }, price_live: { id: 'price_live', active: true }, price_archived: { id: 'price_archived', active: false } };
    await withStripeObjects(known, async () => {
        const fromTest = product({ stripe_product_id: 'prod_from_test', stripe_price_id: 'price_from_test' });
        const archived = product({ code: 'keychain', kind: 'one_time', amount_cents: 3999, stripe_product_id: 'prod_live', stripe_price_id: 'price_archived' });
        const current = product({ code: 'shipping', kind: 'one_time', stripe_product_id: 'prod_live', stripe_price_id: 'price_live' });
        const discount = { id: 7, stripe_coupon_id: 'coupon_from_test' };
        discount.update = async (changes) => Object.assign(discount, changes);

        const forgotten = await catalog.forgetForeignIds({ products: [fromTest, archived, current], discounts: [discount] });
        assert.deepEqual(forgotten, [
            'pro: product prod_from_test and price price_from_test',
            'keychain: price price_archived',
            'discount 7: coupon coupon_from_test',
        ]);
        assert.deepEqual([fromTest.stripe_product_id, fromTest.stripe_price_id], [null, null]);
        assert.deepEqual([archived.stripe_product_id, archived.stripe_price_id], ['prod_live', null]);
        assert.deepEqual([current.stripe_product_id, current.stripe_price_id], ['prod_live', 'price_live']);
        assert.equal(discount.stripe_coupon_id, null);

        // Made again for these keys
        const priceId = await catalog.ensureListPrice(fromTest);
        assert.notEqual(fromTest.stripe_product_id, 'prod_from_test');
        assert.equal(stripe.state.prices[priceId].product, fromTest.stripe_product_id);
        assert.equal(await catalog.unusableStripeId(current), null);
    });
});

test('forgetting stops at any other Stripe error', async () => {
    await withStripeObjects({}, async () => {
        stripe.client.products.retrieve = async () => {
            throw stripe.stripeError('Invalid API Key provided', { type: 'StripeAuthenticationError', statusCode: 401 });
        };
        const pro = product({ stripe_product_id: 'prod_kept' });
        await assert.rejects(catalog.forgetForeignIds({ products: [pro] }), /Invalid API Key/);
        assert.equal(pro.stripe_product_id, 'prod_kept');
    });
});
