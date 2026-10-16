// Buying Access through Stripe (website/access-card: checkout.js, payments.js, subscriptions.js; docs/access.md
// section 6), with Stripe faked (test/fakeStripe.js) and its webhook deliveries signed as Stripe signs them.
const { installFakeStripe } = require('./fakeStripe');
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const { cardFields, cardFiles } = require('./cardFixtures');

let app, q, insert, stripe;
const tokens = {};
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const SHIPPING = { mode: 'flat', flat_amount_cents: 500, countries: ['US'], parcel: { length: 4, width: 4, height: 1, distance_unit: 'in', weight: 0.2, mass_unit: 'lb' } };

before(async () => {
    app = await startApp();
    stripe = installFakeStripe();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (7, 'Professional', 'PRO')");
    await q("INSERT IGNORE INTO countries (id, name, iso2, iso3) VALUES (233, 'United States', 'US', 'USA')");
    await q("INSERT IGNORE INTO states (id, name, country_id, country_code, iso2) VALUES (9001, 'Nevada', 233, 'US', 'NV')");
    await q("INSERT IGNORE INTO cities (id, name, state_id, state_code, country_id, country_code, latitude, longitude) VALUES (9001, 'Las Vegas', 9001, 'NV', 233, 'US', 36.17, -115.14)");
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Test Admin', ?, 1, 1)", [`admin-${stamp}@test.example`]);
    tokens.admin = jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' });
    await q("UPDATE access_settings SET value = ? WHERE setting = 'shipping'", [JSON.stringify(SHIPPING)]);
});
after(async () => {
    await q("UPDATE access_settings SET value = ? WHERE setting = 'shipping'", [JSON.stringify({ ...SHIPPING, mode: 'live', flat_amount_cents: 0 })]);
    await q('DELETE FROM access_discounts');
    await q('DELETE FROM access_price_overrides');
    await app.close();
});

// A card with a checked shipping address; a guest's draft unless `owner` (a user id) is given.
const cardWithAddress = async ({ owner } = {}) => {
    const email = `buyer-${stamp}-${Math.floor(Math.random() * 1e9)}@test.example`;
    const res = await app.form('POST', '/api/v1/businessCard', { fields: cardFields({ email }), files: cardFiles() });
    const { business_card_id: id, card_token: token } = res.body.data;
    const address = await insert("INSERT INTO user_address (user_id, address_line_1, state_id, city_id, province_code, postal_code, is_active) VALUES (NULL, '1 Main St', 9001, 9001, 'NV', '89101', 1)");
    await q('UPDATE business_cards SET user_address_id = ?, address_verified = 1 WHERE id = ?', [address, id]);
    if (owner) await q("UPDATE business_cards SET user_id = ?, status = 'accepted' WHERE id = ?", [owner, id]);
    return { id, token, email };
};
const person = async ({ seat } = {}) => {
    const { createSession } = require('../src/shared/identity');
    const id = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active, email_verified_at) VALUES (?, 7, 'professional', 'individual', 'ACCEPTED', 1, NOW())", [`pro-${stamp}-${Math.floor(Math.random() * 1e9)}@test.example`]);
    if (seat) await insert('INSERT INTO access_subscriptions (user_id, source, status, stripe_subscription_id) VALUES (?, ?, ?, ?)', [id, seat.source, seat.status, seat.stripe_subscription_id || null]);
    return { id, token: (await createSession({ id }, { client: 'test' })).tokens.access_token };
};
const quote = (body, headers) => app.request('POST', '/api/v1/access/checkout/quote', { body, headers });
const pay = (checkoutId, headers) => app.request('POST', `/api/v1/access/checkout/${checkoutId}/pay`, { headers });
const row = async (sql, args) => (await q(sql, args))[0];

describe('a guest buys Pro + keychain', () => {
    let card, checkoutId, subscriptionId, invoiceId;

    test('a quote: Access Pro, the keychain and shipping, at the server\'s prices', async () => {
        card = await cardWithAddress();
        const res = await quote({ business_card_id: card.id, plan_type: 'nfc_with_subscription', total: 1 }, { 'x-card-token': card.token });
        assert.equal(res.status, 200, res.body.message);
        const data = res.body.data;
        checkoutId = data.checkout_id;
        assert.deepEqual(data.lines.map((l) => [l.product, l.amount]), [['pro', 499], ['keychain', 3999]]);
        assert.equal(data.shipping.selected.amount_cents, 500);
        assert.equal(data.total_cents, 4998);
        assert.equal(data.monthly_cents, 499);
        assert.equal(data.shipping.address.street1, '1 Main St');
        assert.equal(data.shipping.address.country, 'US');
    });

    test('paying makes one incomplete subscription with the keychain and shipping on its first invoice', async () => {
        const res = await pay(checkoutId, { 'x-card-token': card.token });
        assert.equal(res.status, 200, res.body.message);
        const [create] = stripe.callsOf('subscriptions.create');
        const p = create.params;
        assert.equal(p.payment_behavior, 'default_incomplete');
        assert.deepEqual(p.billing_mode, { type: 'flexible' });
        assert.deepEqual(p.expand, ['latest_invoice.confirmation_secret']);
        assert.equal(p.payment_settings.save_default_payment_method, 'on_subscription');
        assert.ok(p.items[0].price, 'Access Pro at its list Price');
        assert.equal(p.add_invoice_items.length, 2);
        assert.equal(p.add_invoice_items[1].price_data.unit_amount, 500, 'shipping');
        assert.equal(p.metadata.access_checkout_id, String(checkoutId));
        assert.equal(create.options.idempotencyKey, `glamlink-checkout-${checkoutId}`);
        assert.match(res.body.data.client_secret, /^pi_for_in_test_\d+_secret_/);
        subscriptionId = res.body.data.stripe_subscription_id;
        invoiceId = (await row('SELECT stripe_invoice_id FROM access_checkouts WHERE id = ?', [checkoutId])).stripe_invoice_id;
        const again = await pay(checkoutId, { 'x-card-token': card.token });
        assert.equal(again.body.data.client_secret, res.body.data.client_secret, 'paying again gives the same secret');
        assert.equal(stripe.callsOf('subscriptions.create').length, 1);
    });

    test('Stripe confirms the first invoice: account, seat, live card, payment, order, emails', async () => {
        const res = await stripe.deliver(app, 'invoice.paid', {
            id: invoiceId, object: 'invoice', amount_paid: 4998, billing_reason: 'subscription_create',
            hosted_invoice_url: 'https://invoice.stripe.example/i/1', parent: { type: 'subscription_details', subscription_details: { subscription: subscriptionId } },
        });
        assert.equal(res.status, 200);
        const user = await row('SELECT id, account_type, subscription_status, stripe_customer_id FROM users WHERE email = ?', [card.email]);
        assert.equal(user.account_type, 'professional');
        assert.equal(user.subscription_status, 'ACTIVE');
        assert.ok(user.stripe_customer_id);
        const c = await row('SELECT user_id, status, nfc_status, plan_type FROM business_cards WHERE id = ?', [card.id]);
        assert.deepEqual([String(c.user_id), c.status, c.nfc_status, c.plan_type], [String(user.id), 'accepted', 'paid', 'nfc_with_subscription']);
        const seat = await row('SELECT source, status, stripe_subscription_id FROM access_subscriptions WHERE user_id = ?', [user.id]);
        assert.deepEqual([seat.source, seat.status, seat.stripe_subscription_id], ['stripe', 'active', subscriptionId]);
        const payment = await row('SELECT payment_type, payment_status, amount, receipt_url FROM payments WHERE transaction_id = ?', [invoiceId]);
        assert.deepEqual([payment.payment_type, payment.payment_status, Number(payment.amount)], ['NFC_WITH_SUBSCRIPTION', 'SUCCESS', 49.98]);
        const order = await row('SELECT fulfillment_status, shipping_address_line_1, shipping_amount FROM access_orders WHERE business_card_id = ?', [card.id]);
        assert.deepEqual([order.fulfillment_status, order.shipping_address_line_1, Number(order.shipping_amount)], ['pending', '1 Main St', 5]);
        const checkout = (await app.request('GET', `/api/v1/access/checkout/${checkoutId}`, { headers: { 'x-card-token': card.token } })).body.data;
        assert.equal(checkout.status, 'paid');
        assert.ok(app.outbox.some((m) => m.to === card.email && /reset-password\?token=/.test(m.html || m.text || '')), 'welcome email');
        assert.ok(app.outbox.some((m) => /access-orders\/\d+/.test(m.html || '') && (m.html || '').includes('https://admin.glamlink.net')), 'admin order email with its link');
    });

    test('the same event again is not processed twice', async () => {
        const event = { id: invoiceId, object: 'invoice', amount_paid: 4998, parent: { subscription_details: { subscription: subscriptionId } } };
        const first = await stripe.deliver(app, 'invoice.paid', event, `evt_dup_${stamp}`);
        const second = await stripe.deliver(app, 'invoice.paid', event, `evt_dup_${stamp}`);
        assert.equal(first.status, 200);
        assert.equal(second.body.duplicate, true);
        assert.equal((await q('SELECT id FROM payments WHERE transaction_id = ?', [invoiceId])).length, 1);
    });

    test('a renewal is recorded; cancelling at the end of the month, then the end', async () => {
        await stripe.deliver(app, 'invoice.paid', { id: `in_renewal_${stamp}`, amount_paid: 499, billing_reason: 'subscription_cycle', parent: { subscription_details: { subscription: subscriptionId } } });
        const renewal = await row('SELECT payment_type, amount FROM payments WHERE transaction_id = ?', [`in_renewal_${stamp}`]);
        assert.deepEqual([renewal.payment_type, Number(renewal.amount)], ['SUBSCRIPTION_RENEWAL', 4.99]);

        stripe.state.subscriptions[subscriptionId].cancel_at_period_end = true;
        await stripe.deliver(app, 'customer.subscription.updated', stripe.subscription(subscriptionId));
        const user = await row('SELECT id FROM users WHERE email = ?', [card.email]);
        assert.equal((await row('SELECT cancel_at_period_end FROM access_subscriptions WHERE user_id = ?', [user.id])).cancel_at_period_end, 1);

        Object.assign(stripe.state.subscriptions[subscriptionId], { status: 'canceled', ended_at: Math.floor(Date.now() / 1000) });
        await stripe.deliver(app, 'customer.subscription.deleted', stripe.subscription(subscriptionId));
        const c = await row('SELECT plan_type, nfc_status FROM business_cards WHERE id = ?', [card.id]);
        assert.deepEqual([c.plan_type, c.nfc_status], ['nfc_only', 'paid'], 'the keychain stays theirs');
        assert.equal((await row('SELECT subscription_status FROM users WHERE id = ?', [user.id])).subscription_status, 'CANCELLED');
    });
});

describe('a signed-in owner', () => {
    test('buys the keychain alone, during a sale: one PaymentIntent for the computed total', async () => {
        const owner = await person();
        const card = await cardWithAddress({ owner: owner.id });
        await app.request('POST', '/api/v1/access/admin/discounts', { token: tokens.admin, body: { name: 'Sale', percent_off: 10, applies_to: ['keychain'] } });
        const quoted = await quote({ business_card_id: card.id, plan_type: 'nfc_only' }, { 'x-access-token': owner.token });
        assert.equal(quoted.status, 200, quoted.body.message);
        assert.equal(quoted.body.data.total_cents, 3599 + 500);
        const paid = await pay(quoted.body.data.checkout_id, { 'x-access-token': owner.token });
        assert.equal(paid.status, 200, paid.body.message);
        const [intent] = stripe.callsOf('paymentIntents.create').slice(-1);
        assert.equal(intent.params.amount, 4099);
        assert.deepEqual(intent.params.automatic_payment_methods, { enabled: true });
        assert.equal(intent.params.shipping.address.postal_code, '89101');
        await stripe.deliver(app, 'payment_intent.succeeded', { id: paid.body.data.payment_intent_id, object: 'payment_intent', amount: 4099, amount_received: 4099, metadata: intent.params.metadata });
        const c = await row('SELECT nfc_status, plan_type FROM business_cards WHERE id = ?', [card.id]);
        assert.deepEqual([c.nfc_status, c.plan_type], ['paid', 'nfc_only']);
        assert.equal((await row('SELECT payment_type FROM payments WHERE transaction_id = ?', [paid.body.data.payment_intent_id])).payment_type, 'NFC_ONLY');
        const again = await quote({ business_card_id: card.id, plan_type: 'nfc_only' }, { 'x-access-token': owner.token });
        assert.equal(again.body.code, 'NFC_ALREADY_PURCHASED');
        await q('DELETE FROM access_discounts');
    });

    test('with Pro already (complimentary): Pro is not sold again; Pro + keychain sells just the keychain', async () => {
        const owner = await person({ seat: { source: 'comp', status: 'active' } });
        const card = await cardWithAddress({ owner: owner.id });
        const pro = await quote({ business_card_id: card.id, plan_type: 'subscription_only' }, { 'x-access-token': owner.token });
        assert.equal(pro.status, 409);
        assert.equal(pro.body.code, 'ALREADY_OWNED');
        const both = await quote({ business_card_id: card.id, plan_type: 'nfc_with_subscription' }, { 'x-access-token': owner.token });
        assert.deepEqual(both.body.data.lines.map((l) => l.product), ['keychain']);
    });

    test('a personal price goes on the subscription as its own amount; a sale as the item\'s coupon', async () => {
        const owner = await person();
        const card = await cardWithAddress({ owner: owner.id });
        await app.request('POST', '/api/v1/access/admin/custom-prices', { token: tokens.admin, body: { user_id: owner.id, product_code: 'pro', amount_cents: 299 } });
        const quoted = await quote({ business_card_id: card.id, plan_type: 'subscription_only' }, { 'x-access-token': owner.token });
        await pay(quoted.body.data.checkout_id, { 'x-access-token': owner.token });
        const [personal] = stripe.callsOf('subscriptions.create').slice(-1);
        assert.equal(personal.params.items[0].price_data.unit_amount, 299);
        assert.deepEqual(personal.params.items[0].price_data.recurring, { interval: 'month' });

        const other = await person();
        const otherCard = await cardWithAddress({ owner: other.id });
        await app.request('POST', '/api/v1/access/admin/discounts', { token: tokens.admin, body: { name: 'Pro sale', percent_off: 20, applies_to: ['pro'], duration: 'repeating', duration_in_months: 3 } });
        const saleQuote = await quote({ business_card_id: otherCard.id, plan_type: 'subscription_only' }, { 'x-access-token': other.token });
        await pay(saleQuote.body.data.checkout_id, { 'x-access-token': other.token });
        const [sale] = stripe.callsOf('subscriptions.create').slice(-1);
        assert.ok(sale.params.items[0].price);
        assert.equal(sale.params.items[0].discounts.length, 1);
        const [coupon] = stripe.callsOf('coupons.create').slice(-1);
        assert.deepEqual([coupon.params.percent_off, coupon.params.duration, coupon.params.duration_in_months], [20, 'repeating', 3]);
        await q('DELETE FROM access_discounts');
    });

    test('cancels at the end of the month and resumes', async () => {
        const subId = `sub_member_${stamp}`;
        stripe.addSubscription(subId);
        const owner = await person({ seat: { source: 'stripe', status: 'active', stripe_subscription_id: subId } });
        const cancelled = await app.request('POST', '/api/v1/access/subscription/cancel', { token: owner.token });
        assert.equal(cancelled.status, 200, cancelled.body.message);
        assert.equal(cancelled.body.data.cancel_at_period_end, true);
        assert.equal(cancelled.body.data.pro, true, 'Pro until the end of the month');
        const resumed = await app.request('POST', '/api/v1/access/subscription/resume', { token: owner.token });
        assert.equal(resumed.body.data.cancel_at_period_end, false);
        const old = await app.request('POST', '/api/v1/businessCard/cancel-subscription', { token: owner.token });
        assert.equal(old.status, 200, 'the old call cancels at the end of the month too');
        assert.equal(old.body.data.cancel_at_period_end, true);
    });
});

describe('the old purchase calls', () => {
    test('shipping-rate-public and create-subscription-public answer as before, on the checkout', async () => {
        const card = await cardWithAddress();
        const headers = { 'x-card-token': card.token };
        const rate = await app.request('POST', '/api/v1/businessCard/shipping-rate-public', { body: { business_card_id: card.id, plan_type: 'nfc_only' }, headers });
        assert.equal(rate.status, 200, rate.body.message);
        assert.deepEqual([rate.body.data.nfc_price, rate.body.data.shipping_amount, rate.body.data.total_due_today], [39.99, 5, 44.99]);
        const created = await app.request('POST', '/api/v1/businessCard/create-subscription-public', { body: { business_card_id: card.id, plan_type: 'nfc_only' }, headers });
        assert.equal(created.status, 200, created.body.message);
        assert.equal(created.body.data.checkout_id, rate.body.data.checkout_id, 'pays the quote just made');
        assert.match(created.body.data.clientSecret, /_secret_/);
        assert.equal(created.body.data.amount, '44.99');
    });
});

describe('admin', () => {
    test('gives and takes back complimentary Pro; lists seats', async () => {
        const who = await person();
        const given = await app.request('PUT', `/api/v1/access/admin/subscriptions/${who.id}/comp`, { token: tokens.admin, body: { active: true } });
        assert.equal(given.status, 200, given.body.message);
        assert.equal((await row('SELECT subscription_status FROM users WHERE id = ?', [who.id])).subscription_status, 'ACTIVE');
        const list = await app.request('GET', '/api/v1/access/admin/subscriptions?source=comp', { token: tokens.admin });
        assert.ok(list.body.data.some((s) => String(s.user_id) === String(who.id)));
        await app.request('PUT', `/api/v1/access/admin/subscriptions/${who.id}/comp`, { token: tokens.admin, body: { active: false } });
        assert.equal((await row('SELECT subscription_status FROM users WHERE id = ?', [who.id])).subscription_status, 'CANCELLED');
    });

    test('a new Pro price can move paying subscribers from their next renewal', async () => {
        const subId = `sub_move_${stamp}`;
        stripe.addSubscription(subId);
        await person({ seat: { source: 'stripe', status: 'active', stripe_subscription_id: subId } });
        const res = await app.request('PUT', '/api/v1/access/admin/products/pro/price', { token: tokens.admin, body: { amount_cents: 599, move_subscribers: true } });
        assert.equal(res.status, 200, res.body.message);
        assert.ok(res.body.data.moved >= 1);
        const moved = stripe.callsOf('subscriptions.update').find((c) => c.params.id === subId);
        assert.equal(moved.params.proration_behavior, 'none');
        await app.request('PUT', '/api/v1/access/admin/products/pro/price', { token: tokens.admin, body: { amount_cents: 499 } });
    });
});
