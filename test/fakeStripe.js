// A fake Stripe for tests: the app's Stripe client (integrations/stripe.js) with its API calls replaced by
// recording fakes that answer like Stripe's API 2026-09-30. Webhook signing stays real.
const WEBHOOK_SECRET = 'whsec_test_glamlink_webhook';
process.env.STRIPE_WEBHOOK_SECRET_INTENT_CHARGE = WEBHOOK_SECRET; // before the app reads its config

const installFakeStripe = () => {
    const { stripe } = require('../src/integrations/stripe');
    const client = stripe();
    const calls = [];
    const state = { subscriptions: {}, n: 0 };
    const id = (prefix) => `${prefix}_test_${++state.n}`;
    const record = (name, params, options) => calls.push({ name, params, options });
    const now = Math.floor(Date.now() / 1000);

    const subscriptionObject = (sub) => ({
        id: sub.id,
        object: 'subscription',
        customer: sub.customer,
        status: sub.status,
        currency: 'usd',
        start_date: now,
        cancel_at_period_end: Boolean(sub.cancel_at_period_end),
        canceled_at: sub.canceled_at || null,
        ended_at: sub.ended_at || null,
        items: { data: [{ id: `${sub.id}_item`, current_period_end: now + 30 * 86400, price: sub.price }] },
    });

    client.customers.create = async (params, options) => {
        record('customers.create', params, options);
        return { id: id('cus'), email: params.email };
    };
    client.products.search = async (params) => {
        record('products.search', params);
        return { data: [] };
    };
    client.products.create = async (params, options) => {
        record('products.create', params, options);
        return { id: id('prod'), name: params.name };
    };
    client.prices.create = async (params, options) => {
        record('prices.create', params, options);
        return { id: id('price'), ...params };
    };
    client.prices.retrieve = async (priceId) => {
        record('prices.retrieve', priceId);
        return { id: priceId, active: true, unit_amount: 499, recurring: { interval: 'month' }, product: 'prod_legacy' };
    };
    client.coupons.create = async (params, options) => {
        record('coupons.create', params, options);
        return { id: id('coupon'), ...params };
    };
    client.subscriptions.create = async (params, options) => {
        record('subscriptions.create', params, options);
        const subId = id('sub');
        const item = params.items[0];
        state.subscriptions[subId] = {
            id: subId, customer: params.customer, status: 'incomplete',
            price: { id: item.price || id('price'), unit_amount: item.price_data?.unit_amount ?? 499 },
        };
        const invoiceId = id('in');
        return {
            ...subscriptionObject(state.subscriptions[subId]),
            latest_invoice: { id: invoiceId, confirmation_secret: { client_secret: `pi_for_${invoiceId}_secret_abc`, type: 'payment_intent' } },
        };
    };
    client.subscriptions.retrieve = async (subId) => {
        record('subscriptions.retrieve', subId);
        const sub = state.subscriptions[subId];
        if (!sub) throw Object.assign(new Error(`No such subscription: ${subId}`), { type: 'StripeInvalidRequestError', statusCode: 404 });
        if (sub.status === 'incomplete') sub.status = 'active';
        return subscriptionObject(sub);
    };
    client.subscriptions.update = async (subId, params, options) => {
        record('subscriptions.update', { id: subId, ...params }, options);
        const sub = state.subscriptions[subId];
        if ('cancel_at_period_end' in params) sub.cancel_at_period_end = params.cancel_at_period_end;
        if (params.items) {
            const item = params.items[0];
            sub.price = { id: item.price || id('price'), unit_amount: item.price_data?.unit_amount ?? sub.price.unit_amount };
        }
        return subscriptionObject(sub);
    };
    client.subscriptions.cancel = async (subId) => {
        record('subscriptions.cancel', subId);
        const sub = state.subscriptions[subId];
        Object.assign(sub, { status: 'canceled', canceled_at: now, ended_at: now });
        return subscriptionObject(sub);
    };
    client.paymentIntents.create = async (params, options) => {
        record('paymentIntents.create', params, options);
        const piId = id('pi');
        return { id: piId, amount: params.amount, client_secret: `${piId}_secret_xyz`, metadata: params.metadata };
    };

    // A subscription Stripe knows about (an existing subscriber's).
    const addSubscription = (subId, { status = 'active', price = { id: 'price_legacy', unit_amount: 499 } } = {}) => {
        state.subscriptions[subId] = { id: subId, customer: 'cus_existing', status, price };
        return subscriptionObject(state.subscriptions[subId]);
    };
    const subscription = (subId) => subscriptionObject(state.subscriptions[subId]);

    // Delivers a Stripe event to the webhook, signed as Stripe signs it.
    const deliver = (app, type, object, eventId = id('evt')) => {
        const event = { id: eventId, object: 'event', type, data: { object } };
        const payload = JSON.stringify(event);
        const signature = client.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
        return app.request('POST', '/api/v1/payment/stripe/charge-intent/webhooks', { body: event, headers: { 'stripe-signature': signature } });
    };

    const callsOf = (name) => calls.filter((c) => c.name === name);
    return { client, calls, callsOf, state, addSubscription, subscription, deliver };
};

module.exports = { installFakeStripe, WEBHOOK_SECRET };
