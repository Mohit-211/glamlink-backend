// The Access payment flow made whole (Nov 1): the checkout poll and a sweeper ask Stripe when the webhook is late or
// lost, one payment under way per card, $0 payments, customers Stripe no longer has, choosing Free with the keychain,
// app accounts' emails, professional or brand, the seat after a failed renewal and the billing portal, an admin's order
// cancel, refunds and disputes recorded, the orders list, a deleted account's Pro (website/access-card: checkout.js,
// checkoutSync.js, payments.js, subscriptions.js; docs/access.md section 6). Stripe is faked (test/fakeStripe.js).
const { installFakeStripe, eventually } = require('./fakeStripe');
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const { cardFields, cardFiles } = require('./cardFixtures');

let app, q, insert, stripe, createSession;
const tokens = {};
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const SHIPPING = { mode: 'flat', flat_amount_cents: 500, countries: ['US'], parcel: { length: 4, width: 4, height: 1, distance_unit: 'in', weight: 0.2, mass_unit: 'lb' } };
const BRAND_ROLE = Number(process.env.BRND_ROLE_ID);
// The names on this file's cards sort after every other test's pages (the admin page list is by name, 50 at a time).
const NAME = 'Zz Buyer';
const BRAND = { professional_type: 'brand', business_name: 'Zz Test Brand' };

before(async () => {
    app = await startApp();
    stripe = installFakeStripe();
    ({ createSession } = require('../src/shared/identity'));
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (6, 'User', 'USR'), (7, 'Professional', 'PRO'), (?, 'Brand', 'BRND')", [BRAND_ROLE]);
    await q("INSERT IGNORE INTO countries (id, name, iso2, iso3) VALUES (233, 'United States', 'US', 'USA')");
    await q("INSERT IGNORE INTO states (id, name, country_id, country_code, iso2) VALUES (9001, 'Nevada', 233, 'US', 'NV')");
    await q("INSERT IGNORE INTO cities (id, name, state_id, state_code, country_id, country_code, latitude, longitude) VALUES (9001, 'Las Vegas', 9001, 'NV', 233, 'US', 36.17, -115.14)");
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Test Admin', ?, 1, 1)", [`admin-flow-${stamp}@test.example`]);
    tokens.admin = jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' });
    await q("UPDATE access_settings SET value = ? WHERE setting = 'shipping'", [JSON.stringify(SHIPPING)]);
});
after(async () => {
    await q("UPDATE access_settings SET value = ? WHERE setting = 'shipping'", [JSON.stringify({ ...SHIPPING, mode: 'live', flat_amount_cents: 0 })]);
    await q('DELETE FROM access_discounts');
    await app.close();
});

const row = async (sql, args) => (await q(sql, args))[0];
const uniqueEmail = (what) => `${what}-${stamp}-${Math.floor(Math.random() * 1e9)}@test.example`;

// A guest's draft with a checked shipping address; `owner` (a user id) makes it theirs and live.
const cardWithAddress = async ({ owner, email = uniqueEmail('buyer'), fields = {} } = {}) => {
    const res = await app.form('POST', '/api/v1/businessCard', { fields: cardFields({ name: NAME, email, ...fields }), files: cardFiles() });
    assert.equal(res.status, 201, res.body.message);
    const { business_card_id: id, card_token: token } = res.body.data;
    const address = await insert("INSERT INTO user_address (user_id, address_line_1, state_id, city_id, province_code, postal_code, is_active) VALUES (NULL, '1 Main St', 9001, 9001, 'NV', '89101', 1)");
    await q('UPDATE business_cards SET user_address_id = ?, address_verified = 1 WHERE id = ?', [address, id]);
    if (owner) await q("UPDATE business_cards SET user_id = ?, status = 'accepted' WHERE id = ?", [owner, id]);
    return { id, token, email, headers: { 'x-card-token': token } };
};
// A signed-in professional (an app account with `app`), with a seat when given.
const person = async ({ seat, email = uniqueEmail('pro'), app: appOnly = false } = {}) => {
    const id = await insert(
        "INSERT INTO users (email, role_id, account_type, professional_type, status, is_active, email_verified_at, password) VALUES (?, ?, ?, ?, 'ACCEPTED', 1, NOW(), 'not-a-real-hash')",
        [email, appOnly ? 6 : 7, appOnly ? 'user' : 'professional', appOnly ? null : 'individual'],
    );
    if (seat) await insert('INSERT INTO access_subscriptions (user_id, source, status, stripe_subscription_id) VALUES (?, ?, ?, ?)', [id, seat.source, seat.status, seat.stripe_subscription_id || null]);
    return { id, email, token: (await createSession({ id }, { client: 'test' })).tokens.access_token };
};
const signIn = async (email) => {
    const { id } = await row('SELECT id FROM users WHERE email = ?', [email]);
    return { id, token: (await createSession({ id }, { client: 'test' })).tokens.access_token };
};

const quote = (body, headers) => app.request('POST', '/api/v1/access/checkout/quote', { body, headers });
const pay = (checkoutId, headers) => app.request('POST', `/api/v1/access/checkout/${checkoutId}/pay`, { headers });
const poll = (checkoutId, headers) => app.request('GET', `/api/v1/access/checkout/${checkoutId}`, { headers });
const selectPlan = (card, plan) => app.request('POST', '/api/v1/businessCard/select-plan', { body: { business_card_id: card.id, plan_type: plan }, headers: card.headers });
// The poll asks Stripe at most every few seconds; a test asks again at once.
const askAgain = (checkoutId) => q('UPDATE access_checkouts SET synced_at = NULL WHERE id = ?', [checkoutId]);
const mails = (to, subject) => app.outbox.filter((m) => m.to === to && (!subject || subject.test(m.subject)));

// A card's plan quoted and paid (Stripe waits for the buyer): { card, checkoutId, paid, subId, pi }.
const startPaying = async (plan, options) => {
    const card = await cardWithAddress(options);
    const quoted = await quote({ business_card_id: card.id, plan_type: plan }, card.headers);
    assert.equal(quoted.status, 200, quoted.body.message);
    const paid = await pay(quoted.body.data.checkout_id, card.headers);
    assert.equal(paid.status, 200, paid.body.message);
    return { card, checkoutId: quoted.body.data.checkout_id, total: quoted.body.data.total_cents, paid: paid.body.data, subId: paid.body.data.stripe_subscription_id, pi: paid.body.data.payment_intent_id };
};
// The buyer pays and Stripe's webhook says so.
const confirm = async (purchase) => {
    if (purchase.subId) {
        const invoice = stripe.payInvoice(stripe.invoiceOf(purchase.subId).id);
        assert.equal((await stripe.deliver(app, 'invoice.paid', invoice)).status, 200);
        return { ...purchase, invoice };
    }
    stripe.setIntent(purchase.pi, { status: 'succeeded', amount_received: purchase.total });
    const intent = { id: purchase.pi, object: 'payment_intent', amount: purchase.total, amount_received: purchase.total, metadata: { access_checkout_id: String(purchase.checkoutId) } };
    assert.equal((await stripe.deliver(app, 'payment_intent.succeeded', intent)).status, 200);
    return purchase;
};
const buy = async (plan, options) => confirm(await startPaying(plan, options));

describe('the checkout poll asks Stripe (BE-01)', () => {
    test('paid at Stripe with no webhook: the poll makes the card live; the late webhook changes nothing more', async () => {
        const purchase = await startPaying('subscription_only');
        const { card, checkoutId } = purchase;
        const waiting = await poll(checkoutId, card.headers);
        assert.equal(waiting.status, 200, waiting.body.message);
        assert.deepEqual([waiting.body.data.status, waiting.body.data.client_secret], ['pending', purchase.paid.client_secret]);

        const invoice = stripe.payInvoice(stripe.invoiceOf(purchase.subId).id);
        await askAgain(checkoutId);
        const done = (await poll(checkoutId, card.headers)).body.data;
        assert.equal(done.status, 'paid');
        assert.equal(done.client_secret, undefined);
        assert.deepEqual([String(done.card.business_card_id), done.card.status], [String(card.id), 'accepted']);
        assert.match(done.card.business_card_link, /\/access\//);
        const user = await row('SELECT id, account_type FROM users WHERE email = ?', [card.email]);
        assert.equal(user.account_type, 'professional');
        assert.equal((await row('SELECT status FROM access_subscriptions WHERE user_id = ?', [user.id])).status, 'active');

        assert.equal((await stripe.deliver(app, 'invoice.paid', invoice)).status, 200);
        assert.equal((await q('SELECT id FROM payments WHERE transaction_id = ?', [invoice.id])).length, 1);
        assert.equal((await q('SELECT id FROM access_orders WHERE business_card_id = ?', [card.id])).length, 1);
    });

    test('a declined attempt is failed and can be paid again; the bank confirming is processing; then paid', async () => {
        const { card, checkoutId, pi, paid } = await startPaying('nfc_only');
        stripe.setIntent(pi, { status: 'requires_payment_method', last_payment_error: { code: 'card_declined' } });
        await askAgain(checkoutId);
        let data = (await poll(checkoutId, card.headers)).body.data;
        assert.deepEqual([data.status, data.client_secret], ['failed', paid.client_secret]);

        stripe.setIntent(pi, { status: 'processing', last_payment_error: null });
        await askAgain(checkoutId);
        data = (await poll(checkoutId, card.headers)).body.data;
        assert.deepEqual([data.status, data.client_secret], ['processing', undefined]);
        assert.equal((await row('SELECT status FROM access_checkouts WHERE id = ?', [checkoutId])).status, 'processing');
        const asked = stripe.callsOf('paymentIntents.retrieve').length;
        await poll(checkoutId, card.headers);
        assert.equal(stripe.callsOf('paymentIntents.retrieve').length, asked, 'asked again within seconds: Stripe is not');

        stripe.setIntent(pi, { status: 'succeeded', amount_received: 4499 });
        await askAgain(checkoutId);
        assert.equal((await poll(checkoutId, card.headers)).body.data.status, 'paid');
        const c = await row('SELECT status, nfc_status, plan_type FROM business_cards WHERE id = ?', [card.id]);
        assert.deepEqual([c.status, c.nfc_status, c.plan_type], ['accepted', 'paid', 'nfc_only']);
    });

    test('only the card\'s buyer, owner or an admin learns anything about a checkout (BE-38)', async () => {
        const card = await cardWithAddress();
        const other = await cardWithAddress();
        const quoted = await quote({ business_card_id: card.id, plan_type: 'nfc_only' }, card.headers);
        const id = quoted.body.data.checkout_id;
        const nothing = await poll(id, {});
        assert.deepEqual([nothing.status, nothing.body.code], [401, 'CARD_TOKEN_REQUIRED']);
        const missing = await poll(999999999, {});
        assert.deepEqual([missing.status, missing.body.code], [401, 'CARD_TOKEN_REQUIRED'], 'the same whether it exists or not');
        assert.equal((await poll(id, other.headers)).status, 404);
        assert.equal((await poll(999999999, other.headers)).status, 404);
        assert.equal((await pay(id, other.headers)).status, 404);
        const stranger = await person();
        assert.equal((await poll(id, { 'x-access-token': stranger.token })).status, 404);
        assert.equal((await poll(id, { 'x-access-token': tokens.admin })).status, 200);
        assert.equal((await poll(id, card.headers)).body.data.status, 'open');
    });

    test('the sweeper makes a paid card live without its webhook, and stops a payment left too long', async () => {
        const { sweepCheckouts } = require('../src/website/access-card/checkoutSync');
        const paidOne = await startPaying('subscription_only');
        stripe.payInvoice(stripe.invoiceOf(paidOne.subId).id);
        const leftOne = await startPaying('nfc_only');
        await q('UPDATE access_checkouts SET created_at = NOW() - INTERVAL 1 HOUR, synced_at = NULL WHERE id IN (?, ?)', [paidOne.checkoutId, leftOne.checkoutId]);
        await q('UPDATE access_checkouts SET expires_at = NOW() - INTERVAL 1 MINUTE WHERE id = ?', [leftOne.checkoutId]);
        assert.ok(await sweepCheckouts() >= 2);
        assert.equal((await row('SELECT status FROM access_checkouts WHERE id = ?', [paidOne.checkoutId])).status, 'paid');
        assert.equal((await row('SELECT status FROM business_cards WHERE id = ?', [paidOne.card.id])).status, 'accepted');
        assert.equal((await row('SELECT status FROM access_checkouts WHERE id = ?', [leftOne.checkoutId])).status, 'expired');
        assert.equal(stripe.state.intents[leftOne.pi].status, 'canceled', 'it can no longer be paid');
    });
});

describe('an activation that fails leaves nothing behind (BE-12)', () => {
    test('the account made for a guest is undone with it; Stripe\'s retry makes it again, with the set-password email', async () => {
        const purchase = await startPaying('subscription_only');
        const invoice = stripe.payInvoice(stripe.invoiceOf(purchase.subId).id);
        const { AccessOrder } = require('../src/models');
        const create = AccessOrder.create;
        AccessOrder.create = async () => { throw new Error('database unavailable'); };
        const failed = await stripe.deliver(app, 'invoice.paid', invoice, `evt_retry_${stamp}`);
        AccessOrder.create = create;
        assert.equal(failed.status, 400);
        assert.equal((await q('SELECT id FROM users WHERE email = ?', [purchase.card.email])).length, 0, 'no account left without its card');
        await new Promise((resolve) => setTimeout(resolve, 100)); // the claim is released after the answer
        assert.equal((await stripe.deliver(app, 'invoice.paid', invoice, `evt_retry_${stamp}`)).status, 200);
        assert.equal((await row('SELECT status FROM business_cards WHERE id = ?', [purchase.card.id])).status, 'accepted');
        await eventually(() => mails(purchase.card.email, /Welcome to Glamlink/).length === 1);
    });
});

describe('a card pays one checkout at a time (BE-02)', () => {
    test('the same plan again gives back the checkout being paid; another plan stops it at Stripe first', async () => {
        const { card, checkoutId, paid, subId } = await startPaying('subscription_only');
        const made = stripe.callsOf('subscriptions.create').length;
        const again = await quote({ business_card_id: card.id, plan_type: 'subscription_only' }, card.headers);
        assert.equal(again.status, 200, again.body.message);
        assert.deepEqual([again.body.data.checkout_id, again.body.data.status, again.body.data.client_secret], [checkoutId, 'pending', paid.client_secret]);
        assert.equal(stripe.callsOf('subscriptions.create').length, made, 'no second subscription');

        const other = await quote({ business_card_id: card.id, plan_type: 'nfc_with_subscription' }, card.headers);
        assert.equal(other.status, 200, other.body.message);
        assert.notEqual(other.body.data.checkout_id, checkoutId);
        assert.equal(other.body.data.status, 'open');
        assert.equal((await row('SELECT status FROM access_checkouts WHERE id = ?', [checkoutId])).status, 'cancelled');
        assert.equal(stripe.invoiceOf(subId).status, 'void', 'the old first invoice can no longer be paid');
        assert.equal(stripe.state.subscriptions[subId].status, 'canceled');

        // The guest's Stripe customer is used again for the card's next payment (BE-29).
        const customers = stripe.callsOf('customers.create').length;
        const next = await pay(other.body.data.checkout_id, card.headers);
        assert.equal(next.status, 200, next.body.message);
        assert.equal(stripe.callsOf('customers.create').length, customers);
        assert.equal(next.body.data.stripe_customer_id, paid.stripe_customer_id);
    });

    test('when Stripe will not void the first invoice of an incomplete subscription, the subscription is cancelled first', async () => {
        const { card, checkoutId, subId } = await startPaying('subscription_only');
        stripe.state.next.refuseVoidWhileIncomplete = true;
        try {
            const other = await quote({ business_card_id: card.id, plan_type: 'nfc_with_subscription' }, card.headers);
            assert.equal(other.status, 200, other.body.message);
        } finally {
            delete stripe.state.next.refuseVoidWhileIncomplete;
        }
        assert.equal(stripe.state.subscriptions[subId].status, 'canceled');
        assert.equal(stripe.invoiceOf(subId).status, 'void');
        assert.equal((await row('SELECT status FROM access_checkouts WHERE id = ?', [checkoutId])).status, 'cancelled');
    });

    test('a payment the bank is confirming, or one taken before its webhook: CHECKOUT_IN_PROGRESS', async () => {
        const purchase = await startPaying('nfc_only');
        const { card, checkoutId, pi } = purchase;
        stripe.setIntent(pi, { status: 'processing' });
        const busy = await quote({ business_card_id: card.id, plan_type: 'nfc_with_subscription' }, card.headers);
        assert.deepEqual([busy.status, busy.body.code, String(busy.body.details.checkout_id)], [409, 'CHECKOUT_IN_PROGRESS', String(checkoutId)]);
        assert.equal(stripe.state.intents[pi].status, 'processing', 'left alone');

        stripe.setIntent(pi, { status: 'succeeded', amount_received: purchase.total });
        const done = await quote({ business_card_id: card.id, plan_type: 'nfc_with_subscription' }, card.headers);
        assert.deepEqual([done.status, done.body.code], [409, 'CHECKOUT_IN_PROGRESS']);
        assert.equal((await row('SELECT status FROM access_checkouts WHERE id = ?', [checkoutId])).status, 'paid', 'activated on the way');

        // The keychain is theirs now: Pro + keychain sells Pro alone (BE-31).
        const pro = await quote({ business_card_id: card.id, plan_type: 'nfc_with_subscription' }, card.headers);
        assert.equal(pro.status, 200, pro.body.message);
        assert.deepEqual(pro.body.data.lines.map((l) => l.product), ['pro']);
        assert.equal(pro.body.data.shipping, null);
    });

    test('two drafts of one email both paid: one seat, the second subscription ends at once, the admins are told (BE-41)', async () => {
        const email = uniqueEmail('twice');
        const first = await startPaying('subscription_only', { email });
        const second = await startPaying('subscription_only', { email });
        await confirm(first);
        await confirm(second);
        const user = await row('SELECT id FROM users WHERE email = ?', [email]);
        assert.equal((await row('SELECT stripe_subscription_id FROM access_subscriptions WHERE user_id = ?', [user.id])).stripe_subscription_id, first.subId);
        const cancel = stripe.callsOf('subscriptions.cancel').find((c) => c.params.id === second.subId);
        assert.deepEqual([cancel.params.prorate, cancel.params.invoice_now], [false, false]);
        const order = await row('SELECT cancelled_at, cancel_reason FROM access_orders WHERE business_card_id = ?', [second.card.id]);
        assert.ok(order.cancelled_at);
        assert.match(order.cancel_reason, /they already had Access Pro/);
        const draft = await row('SELECT user_id, status FROM business_cards WHERE id = ?', [second.card.id]);
        assert.deepEqual([draft.user_id, draft.status], [null, 'draft'], 'one live card per person');
        await eventually(() => mails('support@glamlink.net', /Duplicate Access purchase/).length > 0);
    });
});

describe('paid but not given', () => {
    test('Pro paid as its subscription was being cancelled: recorded, not given, the admins told to refund it', async () => {
        const purchase = await startPaying('subscription_only');
        const invoice = stripe.payInvoice(stripe.invoiceOf(purchase.subId).id);
        stripe.state.subscriptions[purchase.subId].status = 'canceled';
        assert.equal((await stripe.deliver(app, 'invoice.paid', invoice)).status, 200);
        const user = await row('SELECT id, subscription_status FROM users WHERE email = ?', [purchase.card.email]);
        assert.equal(await row('SELECT id FROM access_subscriptions WHERE user_id = ?', [user.id]), undefined, 'no seat');
        const order = await row('SELECT cancelled_at, cancel_reason FROM access_orders WHERE business_card_id = ?', [purchase.card.id]);
        assert.ok(order.cancelled_at);
        assert.match(order.cancel_reason, /subscription had been cancelled/);
        assert.equal((await row('SELECT plan_type FROM business_cards WHERE id = ?', [purchase.card.id])).plan_type, 'free');
        await eventually(() => mails('support@glamlink.net').some((m) => m.text.includes(purchase.card.email) && /refund/i.test(m.text)));
    });
});

describe('nothing to pay (BE-07)', () => {
    test('a $0 first invoice: /pay answers paid and the card is live at once; the webhook changes nothing more', async () => {
        const card = await cardWithAddress();
        const quoted = await quote({ business_card_id: card.id, plan_type: 'subscription_only' }, card.headers);
        stripe.state.next.invoiceAmount = 0;
        const paid = await pay(quoted.body.data.checkout_id, card.headers);
        assert.equal(paid.status, 200, paid.body.message);
        assert.deepEqual(paid.body.data, { paid: true, checkout_id: quoted.body.data.checkout_id });
        const c = await row('SELECT status, plan_type FROM business_cards WHERE id = ?', [card.id]);
        assert.deepEqual([c.status, c.plan_type], ['accepted', 'subscription_only']);
        const { stripe_subscription_id: subId } = await row('SELECT stripe_subscription_id FROM access_checkouts WHERE id = ?', [quoted.body.data.checkout_id]);
        const invoice = stripe.invoiceEvent(subId);
        assert.equal((await stripe.deliver(app, 'invoice.paid', invoice)).status, 200);
        assert.equal((await q('SELECT id FROM payments WHERE transaction_id = ?', [invoice.id])).length, 1);
        assert.equal((await pay(quoted.body.data.checkout_id, card.headers)).body.code, 'ALREADY_PAID');
    });

    test('a free keychain needs no Stripe payment and ships; under 50 cents is refused', async () => {
        await q("UPDATE access_settings SET value = ? WHERE setting = 'shipping'", [JSON.stringify({ ...SHIPPING, mode: 'free' })]);
        const free = await app.request('POST', '/api/v1/access/admin/discounts', { token: tokens.admin, body: { name: 'Free keychain', percent_off: 100, applies_to: ['keychain'] } });
        try {
            const card = await cardWithAddress();
            const quoted = await quote({ business_card_id: card.id, plan_type: 'nfc_only' }, card.headers);
            assert.equal(quoted.body.data.total_cents, 0);
            const intents = stripe.callsOf('paymentIntents.create').length;
            const paid = await pay(quoted.body.data.checkout_id, card.headers);
            assert.deepEqual(paid.body.data, { paid: true, checkout_id: quoted.body.data.checkout_id });
            assert.equal(stripe.callsOf('paymentIntents.create').length, intents);
            const order = await row('SELECT fulfillment_status, amount_paid FROM access_orders WHERE business_card_id = ?', [card.id]);
            assert.deepEqual([order.fulfillment_status, Number(order.amount_paid)], ['pending', 0]);

            await app.request('POST', `/api/v1/access/admin/discounts/${free.body.data.id}/end`, { token: tokens.admin });
            await app.request('POST', '/api/v1/access/admin/discounts', { token: tokens.admin, body: { name: 'Almost free', amount_off_cents: 3969, applies_to: ['keychain'] } });
            const other = await cardWithAddress();
            const small = await quote({ business_card_id: other.id, plan_type: 'nfc_only' }, other.headers);
            assert.deepEqual([small.status, small.body.code], [400, 'AMOUNT_TOO_SMALL']);
        } finally {
            await q('DELETE FROM access_discounts');
            await q("UPDATE access_settings SET value = ? WHERE setting = 'shipping'", [JSON.stringify(SHIPPING)]);
        }
    });
});

describe('Stripe customers and repeated requests', () => {
    test('a customer Stripe does not have is made again and kept on the account (BE-03)', async () => {
        const owner = await person();
        await q("UPDATE users SET stripe_customer_id = 'cus_from_live_mode' WHERE id = ?", [owner.id]);
        const card = await cardWithAddress({ owner: owner.id });
        const headers = { 'x-access-token': owner.token };
        const quoted = await quote({ business_card_id: card.id, plan_type: 'nfc_only' }, headers);
        const paid = await pay(quoted.body.data.checkout_id, headers);
        assert.equal(paid.status, 200, paid.body.message);
        assert.notEqual(paid.body.data.stripe_customer_id, 'cus_from_live_mode');
        assert.equal((await row('SELECT stripe_customer_id FROM users WHERE id = ?', [owner.id])).stripe_customer_id, paid.body.data.stripe_customer_id);
    });

    test('Stripe trouble is a 502; the checkout quoted again is paid under a new key (BE-14, BE-40)', async () => {
        const card = await cardWithAddress();
        const first = await quote({ business_card_id: card.id, plan_type: 'nfc_only' }, card.headers);
        const id = first.body.data.checkout_id;
        const create = stripe.client.paymentIntents.create;
        stripe.client.paymentIntents.create = async (params, options) => {
            stripe.calls.push({ name: 'paymentIntents.create', params, options });
            throw stripe.stripeError('An error occurred with our connection to Stripe.', { type: 'StripeAPIError', statusCode: 500 });
        };
        const failed = await pay(id, card.headers);
        stripe.client.paymentIntents.create = create;
        assert.deepEqual([failed.status, failed.body.code], [502, 'PAYMENT_UNAVAILABLE']);
        assert.equal((await row('SELECT status FROM access_checkouts WHERE id = ?', [id])).status, 'open');
        const firstKey = stripe.callsOf('paymentIntents.create').at(-1).options.idempotencyKey;

        const second = await quote({ business_card_id: card.id, plan_type: 'subscription_only' }, card.headers);
        assert.equal(second.body.data.checkout_id, id, 'the same open checkout, quoted again');
        const paid = await pay(id, card.headers);
        assert.equal(paid.status, 200, paid.body.message);
        const secondKey = stripe.callsOf('subscriptions.create').at(-1).options.idempotencyKey;
        assert.notEqual(secondKey, firstKey);
        assert.match(secondKey, new RegExp(`^glamlink-checkout-${id}-payment-`));
    });

    test('an event out of date does not undo a newer state (BE-09)', async () => {
        const subId = `sub_order_${stamp}`;
        stripe.addSubscription(subId);
        const who = await person({ seat: { source: 'stripe', status: 'active', stripe_subscription_id: subId } });
        await stripe.deliver(app, 'customer.subscription.updated', { ...stripe.subscription(subId), cancel_at_period_end: true });
        assert.equal((await row('SELECT cancel_at_period_end FROM access_subscriptions WHERE user_id = ?', [who.id])).cancel_at_period_end, 0, 'Stripe as it is now');
    });
});

describe('choosing a plan (BE-04, BE-13, BE-22)', () => {
    test('Free with the keychain: the card is live on Free at once, then the keychain is paid', async () => {
        const card = await cardWithAddress();
        const chosen = await selectPlan(card, 'nfc_only');
        assert.equal(chosen.status, 200, chosen.body.message);
        assert.deepEqual(chosen.body.data, { payment_required: true, next_step: 'shipping', business_card_id: card.id, plan_type: 'nfc_only' });
        const live = await row('SELECT status, plan_type, nfc_status, user_id FROM business_cards WHERE id = ?', [card.id]);
        assert.deepEqual([live.status, live.plan_type, live.nfc_status], ['accepted', 'free', 'not_purchased']);
        assert.ok(live.user_id);
        assert.equal(mails(card.email, /Welcome to Glamlink/).length, 1, 'the set-password email');

        const quoted = await quote({ business_card_id: card.id, plan_type: 'nfc_only' }, card.headers);
        assert.equal(quoted.status, 200, quoted.body.message);
        const paid = await pay(quoted.body.data.checkout_id, card.headers);
        await confirm({ checkoutId: quoted.body.data.checkout_id, pi: paid.body.data.payment_intent_id, total: quoted.body.data.total_cents });
        const bought = await row('SELECT nfc_status, plan_type, user_id FROM business_cards WHERE id = ?', [card.id]);
        assert.deepEqual([bought.nfc_status, bought.plan_type, String(bought.user_id)], ['paid', 'nfc_only', String(live.user_id)]);
        await eventually(() => mails(card.email, /Your Access Card Is Live/).length === 1);
        assert.equal(mails(card.email, /Welcome to Glamlink/).length, 1, 'no second welcome');
    });

    test('Free twice at once: one account, one email; Free again on a live card sends nothing', async () => {
        const card = await cardWithAddress();
        const [a, b] = await Promise.all([selectPlan(card, 'free'), selectPlan(card, 'free')]);
        assert.deepEqual([a.status, b.status], [200, 200], `${a.body.message} / ${b.body.message}`);
        assert.equal((await q('SELECT id FROM users WHERE email = ?', [card.email])).length, 1);
        assert.equal(mails(card.email).length, 1);
        assert.equal((await selectPlan(card, 'free')).status, 200);
        assert.equal(mails(card.email).length, 1);
    });

    test('a plan not on offer: INVALID_PLAN', async () => {
        const card = await cardWithAddress();
        const res = await selectPlan(card, 'gold');
        assert.deepEqual([res.status, res.body.code], [400, 'INVALID_PLAN']);
    });
});

describe('an app account\'s email (Nov 1)', () => {
    test('is a new email to the website: Free makes the account a professional of the card\'s type, with the set-password email', async () => {
        const appUser = await person({ app: true });
        const created = await app.form('POST', '/api/v1/businessCard', { fields: cardFields({ name: NAME, email: appUser.email, ...BRAND }), files: cardFiles() });
        assert.equal(created.status, 201, created.body.message);
        assert.deepEqual([created.body.data.next_step, created.body.data.account_exists], ['plan_selection', false]);
        const card = { id: created.body.data.business_card_id, headers: { 'x-card-token': created.body.data.card_token } };
        const res = await selectPlan(card, 'free');
        assert.equal(res.status, 200, res.body.message);
        const user = await row('SELECT account_type, professional_type, role_id FROM users WHERE id = ?', [appUser.id]);
        assert.deepEqual([user.account_type, user.professional_type, user.role_id], ['professional', 'brand', BRAND_ROLE]);
        const live = await row('SELECT user_id, status FROM business_cards WHERE id = ?', [card.id]);
        assert.deepEqual([String(live.user_id), live.status], [String(appUser.id), 'accepted']);
        assert.ok(mails(appUser.email).some((m) => /reset-password\?token=/.test(m.html || m.text || '')));
        assert.equal((await q('SELECT id FROM users WHERE email = ?', [appUser.email])).length, 1, 'no account deleted or added');
    });

    test('buys Pro without ACCOUNT_EXISTS; the payment makes it a professional account', async () => {
        const appUser = await person({ app: true });
        const purchase = await buy('subscription_only', { email: appUser.email });
        const user = await row('SELECT account_type, professional_type, role_id FROM users WHERE id = ?', [appUser.id]);
        assert.deepEqual([user.account_type, user.professional_type, user.role_id], ['professional', 'individual', 7]);
        assert.equal(String((await row('SELECT user_id FROM business_cards WHERE id = ?', [purchase.card.id])).user_id), String(appUser.id));
        await eventually(() => mails(appUser.email).some((m) => /reset-password\?token=/.test(m.html || m.text || '')));
    });
});

const signedInCard = (who, fields) => app.form('POST', '/api/v1/businessCard/createBusinessCard', { fields: cardFields({ name: NAME, ...fields }), files: cardFiles(), token: who.token });
const typeOf = async (userId) => row('SELECT professional_type, role_id FROM users WHERE id = ?', [userId]);

describe('professional or brand (one-form.md 5.1)', () => {

    test('signed in with nothing yet: the account takes the card\'s type; the answer carries business_card_id', async () => {
        const who = await person();
        const res = await signedInCard(who, { ...BRAND });
        assert.equal(res.status, 201, res.body.message);
        assert.equal(res.body.data.business_card_id, res.body.data.id);
        assert.equal(res.body.data.professional_type, 'brand');
        assert.deepEqual(Object.values(await typeOf(who.id)), ['brand', BRAND_ROLE]);
    });

    test('with products, or replacing a card: the account keeps its type and the card takes it', async () => {
        const seller = await person();
        await insert("INSERT INTO shops (title, owner_id) VALUES ('Serum', ?)", [seller.id]);
        const sold = await signedInCard(seller, { ...BRAND });
        assert.equal(sold.status, 201, sold.body.message);
        assert.equal(sold.body.data.professional_type, 'individual');
        assert.equal((await typeOf(seller.id)).professional_type, 'individual');

        const owner = await person();
        assert.equal((await signedInCard(owner, {})).status, 201);
        const replaced = await signedInCard(owner, { ...BRAND, replace: 'true' });
        assert.equal(replaced.status, 201, replaced.body.message);
        assert.equal(replaced.body.data.professional_type, 'individual');
    });

    test('claiming a brand draft, a guest paying for one, and an admin\'s card for a new email: brand accounts', async () => {
        const who = await person();
        const draft = await app.form('POST', '/api/v1/businessCard', { fields: cardFields({ name: NAME, email: who.email, ...BRAND }), files: cardFiles() });
        const claimed = await app.request('POST', `/api/v1/access/cards/${draft.body.data.business_card_id}/claim`, { token: who.token, headers: { 'x-card-token': draft.body.data.card_token } });
        assert.equal(claimed.status, 200, claimed.body.message);
        assert.equal((await typeOf(who.id)).professional_type, 'brand');

        const bought = await buy('subscription_only', { fields: { ...BRAND } });
        const buyer = await row('SELECT professional_type, role_id FROM users WHERE email = ?', [bought.card.email]);
        assert.deepEqual([buyer.professional_type, buyer.role_id], ['brand', BRAND_ROLE]);

        const email = uniqueEmail('admin-made');
        const made = await app.form('POST', '/api/v1/businessCard/createBusinessCardByAdmin', { fields: cardFields({ name: NAME, email, ...BRAND }), files: cardFiles(), token: tokens.admin });
        assert.equal(made.status, 201, made.body.message);
        const account = await row('SELECT account_type, professional_type, role_id FROM users WHERE email = ?', [email]);
        assert.deepEqual([account.account_type, account.professional_type, account.role_id], ['professional', 'brand', BRAND_ROLE]);
    });
});

describe('the seat after a failed renewal, and the billing portal (BE-17, BE-18, BE-20)', () => {
    test('the owner is emailed, the seat is past due and still Pro, the portal opens on their customer; Pro ends after the retries', async () => {
        const { card, subId } = await buy('subscription_only');
        const owner = await signIn(card.email);
        const renewal = {
            id: `in_failed_${stamp}`, object: 'invoice', amount_due: 999, billing_reason: 'subscription_cycle',
            hosted_invoice_url: 'https://invoice.stripe.example/renewal', parent: { subscription_details: { subscription: subId } },
        };
        assert.equal((await stripe.deliver(app, 'invoice.payment_failed', renewal)).status, 200);
        stripe.state.subscriptions[subId].status = 'past_due';
        await stripe.deliver(app, 'customer.subscription.updated', stripe.subscription(subId));
        const seat = (await app.request('GET', '/api/v1/access/subscription', { token: owner.token })).body.data;
        assert.deepEqual([seat.status, seat.pro, seat.past_due], ['past_due', true, true]);
        assert.ok(seat.last_payment_failed_at);
        await eventually(() => mails(card.email, /didn't go through/).some((m) => m.text.includes('https://invoice.stripe.example/renewal')));
        await stripe.deliver(app, 'invoice.payment_action_required', { ...renewal, id: `in_action_${stamp}` });
        await eventually(() => mails(card.email, /Confirm your Glamlink Access Pro payment/).length === 1);

        const portal = await app.request('POST', '/api/v1/access/billing-portal', { token: owner.token, body: { return_url: 'https://glamlink.net/dashboard?tab=subscription-plans' } });
        assert.equal(portal.status, 200, portal.body.message);
        assert.match(portal.body.data.url, /^https:\/\/billing\.stripe\.example\//);
        const [session] = stripe.callsOf('billingPortal.sessions.create').slice(-1);
        assert.equal(session.params.return_url, 'https://glamlink.net/dashboard?tab=subscription-plans');
        const elsewhere = await app.request('POST', '/api/v1/access/billing-portal', { token: owner.token, body: { return_url: 'https://evil.example/' } });
        assert.deepEqual([elsewhere.status, elsewhere.body.code], [400, 'INVALID_INPUT']);

        Object.assign(stripe.state.subscriptions[subId], { status: 'canceled', cancellation_details: { reason: 'payment_failed' } });
        await stripe.deliver(app, 'customer.subscription.deleted', stripe.subscription(subId));
        await eventually(() => mails(card.email, /Access Pro has ended/).length === 1);
        assert.match(mails(card.email, /Access Pro has ended/)[0].text, /Hi Zz Buyer,/);
        const c = await row('SELECT status, plan_type FROM business_cards WHERE id = ?', [card.id]);
        assert.deepEqual([c.status, c.plan_type], ['accepted', 'free']);
    });

    test('no Stripe customer: NO_CUSTOMER; and a seat without one says past_due false', async () => {
        const who = await person({ seat: { source: 'comp', status: 'active' } });
        const res = await app.request('POST', '/api/v1/access/billing-portal', { token: who.token, body: {} });
        assert.deepEqual([res.status, res.body.code], [404, 'NO_CUSTOMER']);
        const seat = (await app.request('GET', '/api/v1/access/subscription', { token: who.token })).body.data;
        assert.deepEqual([seat.pro, seat.past_due, seat.last_payment_failed_at], [true, false, null]);
    });
});

describe('an admin cancels an order (Nov 1)', () => {
    test('Pro + keychain: Pro ends now without proration, the keychain does not ship and is no longer theirs, the card stays live on Free; nothing is refunded', async () => {
        const { card, subId } = await buy('nfc_with_subscription');
        const order = await row('SELECT id FROM access_orders WHERE business_card_id = ?', [card.id]);
        const cancel = (body, token = tokens.admin) => app.request('POST', `/api/v1/businessCard/access-orders/${order.id}/cancel`, { token, body });
        assert.equal((await cancel({}, null)).status, 401);
        const res = await cancel({ reason: 'Asked to cancel' });
        assert.equal(res.status, 200, res.body.message);
        const data = res.body.data;
        assert.ok(data.cancelled_at);
        assert.deepEqual(
            [data.cancel_reason, data.fulfillment_status, data.payment_status, data.payment.payment_status, data.checkout.status, data.checkout.plan_type],
            ['Asked to cancel', 'cancelled', 'paid', 'CANCELLED', 'cancelled', 'nfc_with_subscription'],
        );
        const ended = stripe.callsOf('subscriptions.cancel').find((c) => c.params.id === subId);
        assert.deepEqual([ended.params.prorate, ended.params.invoice_now], [false, false]);
        assert.ok(!stripe.calls.some((c) => /refund/i.test(c.name)), 'never a refund');
        const c = await row('SELECT status, plan_type, nfc_status FROM business_cards WHERE id = ?', [card.id]);
        assert.deepEqual([c.status, c.plan_type, c.nfc_status], ['accepted', 'free', 'not_purchased']);
        const again = await cancel({ reason: 'Twice' });
        assert.deepEqual([again.status, again.body.data.cancel_reason], [200, 'Asked to cancel']);
    });
});

describe('refunds and disputes made in Stripe are recorded, nothing more', () => {
    test('a keychain refunded in full; Access Pro refunded in part; a charge that is not ours', async () => {
        const keychain = await buy('nfc_only');
        const refunded = await stripe.deliver(app, 'charge.refunded', { id: `ch_k_${stamp}`, object: 'charge', amount: 4499, amount_refunded: 4499, refunded: true, payment_intent: keychain.pi });
        assert.equal(refunded.status, 200);
        assert.equal((await row('SELECT payment_status FROM payments WHERE transaction_id = ?', [keychain.pi])).payment_status, 'REFUNDED');
        const order = await row('SELECT payment_status, refunded_amount, fulfillment_status FROM access_orders WHERE business_card_id = ?', [keychain.card.id]);
        assert.deepEqual([order.payment_status, Number(order.refunded_amount), order.fulfillment_status], ['refunded', 44.99, 'pending'], 'shipping is the admins\' call');
        assert.equal((await row('SELECT nfc_status FROM business_cards WHERE id = ?', [keychain.card.id])).nfc_status, 'paid');

        const pro = await buy('subscription_only');
        const intentId = stripe.invoiceOf(pro.subId).intent;
        await stripe.deliver(app, 'charge.refunded', { id: `ch_p_${stamp}`, object: 'charge', amount: 999, amount_refunded: 300, refunded: false, payment_intent: intentId });
        const proOrder = await row('SELECT payment_status, refunded_amount FROM access_orders WHERE business_card_id = ?', [pro.card.id]);
        assert.deepEqual([proOrder.payment_status, Number(proOrder.refunded_amount)], ['partially_refunded', 3]);
        assert.equal((await row('SELECT payment_status FROM payments WHERE transaction_id = ?', [pro.invoice.id])).payment_status, 'SUCCESS');
        const user = await row('SELECT id FROM users WHERE email = ?', [pro.card.email]);
        assert.equal((await row('SELECT status FROM access_subscriptions WHERE user_id = ?', [user.id])).status, 'active', 'Pro goes on');

        const other = await stripe.deliver(app, 'charge.refunded', { id: `ch_o_${stamp}`, object: 'charge', amount: 100, amount_refunded: 100, refunded: true, payment_intent: 'pi_not_access' });
        assert.equal(other.status, 200);
    });

    test('a dispute: disputed while open, the admins told; won, as it was', async () => {
        const { card, pi } = await buy('nfc_only');
        const dispute = {
            id: `dp_${stamp}`, object: 'dispute', amount: 4499, charge: `ch_d_${stamp}`, payment_intent: pi, reason: 'fraudulent',
            status: 'needs_response', evidence_details: { due_by: Math.floor(Date.now() / 1000) + 7 * 86400 },
        };
        assert.equal((await stripe.deliver(app, 'charge.dispute.created', dispute)).status, 200);
        assert.equal((await row('SELECT payment_status FROM payments WHERE transaction_id = ?', [pi])).payment_status, 'DISPUTED');
        let order = await row('SELECT payment_status, dispute_status, fulfillment_status FROM access_orders WHERE business_card_id = ?', [card.id]);
        assert.deepEqual([order.payment_status, order.dispute_status, order.fulfillment_status], ['disputed', 'needs_response', 'pending']);
        await eventually(() => mails('support@glamlink.net', /was disputed/).length > 0);

        await stripe.deliver(app, 'charge.dispute.closed', { ...dispute, status: 'won' });
        assert.equal((await row('SELECT payment_status FROM payments WHERE transaction_id = ?', [pi])).payment_status, 'SUCCESS');
        order = await row('SELECT payment_status, dispute_status FROM access_orders WHERE business_card_id = ?', [card.id]);
        assert.deepEqual([order.payment_status, order.dispute_status], ['paid', 'won']);
    });
});

const orderList = (query) => app.request('GET', `/api/v1/businessCard/access-orders${query}`, { token: tokens.admin });

describe('the admin\'s list of orders (BE-06)', () => {
    test('pages and filters from the query string', async () => {
        const first = await orderList('?limit=2&page=1');
        assert.equal(first.status, 200, first.body.message);
        assert.deepEqual([first.body.data.pagination.page, first.body.data.pagination.limit, first.body.data.data.length], [1, 2, 2]);
        assert.ok(first.body.data.pagination.total >= 4);
        assert.equal(first.body.data.pagination.totalPages, Math.ceil(first.body.data.pagination.total / 2));
        const second = await orderList('?limit=2&page=2');
        assert.ok(!second.body.data.data.some((o) => first.body.data.data.some((f) => f.id === o.id)), 'the next two');
        const cancelled = await orderList('?fulfillment_status=cancelled&cancelled=true');
        assert.ok(cancelled.body.data.data.length >= 1);
        assert.ok(cancelled.body.data.data.every((o) => o.fulfillment_status === 'cancelled' && o.cancelled_at));
        const bad = await orderList('?payment_status=lost');
        assert.deepEqual([bad.status, bad.body.code, bad.body.details.field], [400, 'INVALID_INPUT', 'payment_status']);
    });
});

describe('deleting an account (BE-15)', () => {
    test('ends its Access Pro at Stripe at once, without proration or refund', async () => {
        const subId = `sub_closed_${stamp}`;
        stripe.addSubscription(subId);
        const who = await person({ seat: { source: 'stripe', status: 'active', stripe_subscription_id: subId } });
        const res = await app.request('POST', '/api/v1/admin/users/delete', { token: tokens.admin, body: { user_id: [who.id] } });
        assert.equal(res.status, 200, res.body.message);
        const ended = stripe.callsOf('subscriptions.cancel').find((c) => c.params.id === subId);
        assert.deepEqual([ended.params.prorate, ended.params.invoice_now], [false, false]);
        assert.equal((await row('SELECT status FROM access_subscriptions WHERE user_id = ?', [who.id])).status, 'canceled');
    });
});
