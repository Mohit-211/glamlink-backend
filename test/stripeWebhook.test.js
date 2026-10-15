// The Stripe webhook processes each event once (shared/billing/stripeEvents.js).
const WEBHOOK_SECRET = 'whsec_test_glamlink_webhook';
process.env.STRIPE_WEBHOOK_SECRET_INTENT_CHARGE = WEBHOOK_SECRET; // before the app reads its config
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const Stripe = require('stripe');
const { startApp } = require('./helpers');

let app;
const stripe = new Stripe('sk_test_signing_only');
const PATH = '/api/v1/payment/stripe/charge-intent/webhooks';

// Delivers an event the way Stripe does: the raw JSON body with its signature header.
const deliver = (event) => {
    const payload = JSON.stringify(event);
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    return app.request('POST', PATH, { body: event, headers: { 'stripe-signature': signature } });
};
const stored = async (id) => (await app.sequelize.query('SELECT event_id FROM stripe_events WHERE event_id = ?', { replacements: [id] }))[0].length;

before(async () => { app = await startApp(); });
after(() => app.close());

test('a second delivery of the same event is acknowledged without processing', async () => {
    const event = { id: `evt_test_${Date.now()}`, object: 'event', type: 'customer.created', data: { object: {} } };
    const first = await deliver(event);
    assert.equal(first.status, 200);
    assert.equal(first.body.duplicate, undefined);
    assert.equal(await stored(event.id), 1);
    const second = await deliver(event);
    assert.equal(second.status, 200);
    assert.equal(second.body.duplicate, true);
});

test("an event that is not processed successfully can be retried", async () => {
    // A successful charge for a payment we have no record of answers 404, so Stripe retries it later.
    const event = {
        id: `evt_test_unknown_${Date.now()}`, object: 'event', type: 'charge.succeeded',
        data: { object: { id: 'ch_test', object: 'charge', currency: 'usd', amount: 1000, payment_intent: `pi_unknown_${Date.now()}`, metadata: {} } },
    };
    const first = await deliver(event);
    assert.equal(first.status, 404);
    await new Promise((r) => setTimeout(r, 100)); // the claim is released after the response is sent
    assert.equal(await stored(event.id), 0, 'claim released');
    const retry = await deliver(event);
    assert.equal(retry.status, 404, 'the retry is processed again, not skipped as a duplicate');
});

test('an unsigned or wrongly signed event is refused and claims nothing', async () => {
    const event = { id: `evt_forged_${Date.now()}`, object: 'event', type: 'customer.created', data: { object: {} } };
    const res = await app.request('POST', PATH, { body: event, headers: { 'stripe-signature': 't=1,v1=forged' } });
    assert.equal(res.status, 400);
    assert.equal(await stored(event.id), 0);
});
