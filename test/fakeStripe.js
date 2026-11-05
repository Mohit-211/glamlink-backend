// A fake Stripe for tests: the app's Stripe client (integrations/stripe.js) with its API calls replaced by
// recording fakes that answer like Stripe's API 2026-09-30. Webhook signing stays real.
require('./env'); // test mode before anything reads the config, whatever .env's NODE_ENV
const WEBHOOK_SECRET = 'whsec_test_glamlink_webhook';
process.env.STRIPE_WEBHOOK_SECRET_INTENT_CHARGE = WEBHOOK_SECRET; // before the app reads its config

// An error as stripe-node throws it.
const stripeError = (message, { type = 'StripeInvalidRequestError', statusCode = 400, code } = {}) =>
    Object.assign(new Error(message), { type, statusCode, code });
const missing = (what) => stripeError(`No such ${what}`, { statusCode: 404, code: 'resource_missing' });
// An invoice as a webhook event carries it (the fake's own note of its PaymentIntent left out).
const invoicePayload = (inv) => Object.fromEntries(Object.entries(inv).filter(([key]) => key !== 'intent'));

const installFakeStripe = () => {
    const { stripe } = require('../src/integrations/stripe');
    const client = stripe();
    const calls = [];
    // `next`: what the next calls answer (invoiceAmount: the next subscription's first invoice, 0 for nothing to pay;
    // refuseVoidWhileIncomplete: invoices.voidInvoice refuses the first invoice of an incomplete subscription).
    const state = { subscriptions: {}, invoices: {}, intents: {}, customers: {}, prices: {}, next: {}, n: 0 };
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
        cancellation_details: sub.cancellation_details || { reason: null },
        latest_invoice: sub.latest_invoice || null,
        items: { data: [{ id: `${sub.id}_item`, current_period_end: now + 30 * 86400, price: sub.price }] },
    });
    // An invoice as invoices.retrieve answers it, its payment's PaymentIntent expanded.
    const invoiceObject = (inv) => ({
        ...inv,
        payments: { data: [{ is_default: true, payment: { type: 'payment_intent', payment_intent: state.intents[inv.intent] || inv.intent } }] },
    });
    const amountOf = (item) => item.price_data?.unit_amount ?? state.prices[item.price]?.unit_amount ?? 999;

    client.customers.create = async (params, options) => {
        record('customers.create', params, options);
        const customer = { id: id('cus'), email: params.email };
        state.customers[customer.id] = customer;
        return customer;
    };
    client.customers.retrieve = async (customerId) => {
        record('customers.retrieve', customerId);
        if (state.customers[customerId]) return state.customers[customerId];
        throw missing(`customer: '${customerId}'`);
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
        const price = { id: id('price'), active: true, ...params };
        state.prices[price.id] = price;
        return price;
    };
    client.prices.retrieve = async (priceId) => {
        record('prices.retrieve', priceId);
        return { id: priceId, active: true, unit_amount: 499, recurring: { interval: 'month' }, product: 'prod_legacy' };
    };
    client.prices.list = async (params) => {
        record('prices.list', params);
        return { data: Object.values(state.prices).filter((p) => p.product === params.product && p.active) };
    };
    client.prices.update = async (priceId, params) => {
        record('prices.update', { id: priceId, ...params });
        Object.assign(state.prices[priceId] || {}, params);
        return state.prices[priceId];
    };
    client.coupons.create = async (params, options) => {
        record('coupons.create', params, options);
        return { id: id('coupon'), ...params };
    };
    client.subscriptions.create = async (params, options) => {
        record('subscriptions.create', params, options);
        const subId = id('sub');
        const item = params.items[0];
        const invoiceId = id('in');
        const due = state.next.invoiceAmount ?? [item, ...(params.add_invoice_items || [])].reduce((sum, i) => sum + amountOf(i), 0);
        delete state.next.invoiceAmount;
        const intentId = `pi_for_${invoiceId}`;
        state.intents[intentId] = { id: intentId, object: 'payment_intent', status: 'requires_payment_method', amount: due, last_payment_error: null };
        state.invoices[invoiceId] = {
            id: invoiceId, object: 'invoice', status: due === 0 ? 'paid' : 'open', amount_due: due, amount_paid: due === 0 ? 0 : null,
            customer: params.customer, hosted_invoice_url: `https://invoice.stripe.example/${invoiceId}`, billing_reason: 'subscription_create',
            parent: { type: 'subscription_details', subscription_details: { subscription: subId, metadata: params.metadata } },
            intent: intentId,
        };
        state.subscriptions[subId] = {
            id: subId, customer: params.customer, status: due === 0 ? 'active' : 'incomplete', latest_invoice: invoiceId,
            price: { id: item.price || id('price'), unit_amount: item.price_data?.unit_amount ?? amountOf(item) },
        };
        return {
            ...subscriptionObject(state.subscriptions[subId]),
            latest_invoice: {
                ...invoicePayload(state.invoices[invoiceId]),
                confirmation_secret: due === 0 ? null : { client_secret: `${intentId}_secret_abc`, type: 'payment_intent' },
            },
        };
    };
    client.subscriptions.retrieve = async (subId) => {
        record('subscriptions.retrieve', subId);
        const sub = state.subscriptions[subId];
        if (!sub) throw missing(`subscription: ${subId}`);
        if (sub.status === 'incomplete') sub.status = 'active';
        return subscriptionObject(sub);
    };
    client.subscriptions.update = async (subId, params, options) => {
        record('subscriptions.update', { id: subId, ...params }, options);
        const sub = state.subscriptions[subId];
        if (!sub) throw missing(`subscription: ${subId}`);
        if ('cancel_at_period_end' in params) sub.cancel_at_period_end = params.cancel_at_period_end;
        if (params.items) {
            const item = params.items[0];
            sub.price = { id: item.price || id('price'), unit_amount: item.price_data?.unit_amount ?? sub.price.unit_amount };
        }
        return subscriptionObject(sub);
    };
    client.subscriptions.cancel = async (subId, params) => {
        record('subscriptions.cancel', { id: subId, ...params });
        const sub = state.subscriptions[subId];
        if (!sub) throw missing(`subscription: ${subId}`);
        Object.assign(sub, { status: 'canceled', canceled_at: now, ended_at: now, cancellation_details: { reason: 'cancellation_requested' } });
        return subscriptionObject(sub);
    };
    client.invoices.retrieve = async (invoiceId, params) => {
        record('invoices.retrieve', { id: invoiceId, ...params });
        if (!state.invoices[invoiceId]) throw missing(`invoice: ${invoiceId}`);
        return invoiceObject(state.invoices[invoiceId]);
    };
    client.invoices.voidInvoice = async (invoiceId) => {
        record('invoices.voidInvoice', invoiceId);
        const inv = state.invoices[invoiceId];
        if (!inv) throw missing(`invoice: ${invoiceId}`);
        if (inv.status !== 'open') throw stripeError(`You can only void open invoices; this one is ${inv.status}.`);
        const sub = Object.values(state.subscriptions).find((candidate) => candidate.latest_invoice === invoiceId);
        if (state.next.refuseVoidWhileIncomplete && sub?.status === 'incomplete') throw stripeError('This invoice belongs to an incomplete subscription.');
        inv.status = 'void';
        if (state.intents[inv.intent]) state.intents[inv.intent].status = 'canceled';
        return invoiceObject(inv);
    };
    client.invoicePayments.list = async (params) => {
        record('invoicePayments.list', params);
        const inv = Object.values(state.invoices).find((i) => i.intent === params.payment?.payment_intent);
        return { data: inv ? [{ id: id('inpay'), object: 'invoice_payment', invoice: inv.id }] : [] };
    };
    client.paymentIntents.create = async (params, options) => {
        record('paymentIntents.create', params, options);
        const piId = id('pi');
        state.intents[piId] = { id: piId, object: 'payment_intent', status: 'requires_payment_method', amount: params.amount, last_payment_error: null, metadata: params.metadata };
        return { ...state.intents[piId], client_secret: `${piId}_secret_xyz` };
    };
    client.paymentIntents.retrieve = async (piId) => {
        record('paymentIntents.retrieve', piId);
        if (!state.intents[piId]) throw missing(`payment_intent: ${piId}`);
        return { ...state.intents[piId] };
    };
    client.paymentIntents.cancel = async (piId) => {
        record('paymentIntents.cancel', piId);
        const intent = state.intents[piId];
        if (!intent) throw missing(`payment_intent: ${piId}`);
        if (['succeeded', 'processing', 'canceled'].includes(intent.status)) {
            throw stripeError(`This PaymentIntent's status is ${intent.status}.`, { code: 'payment_intent_unexpected_state' });
        }
        intent.status = 'canceled';
        return { ...intent };
    };
    client.billingPortal.sessions.create = async (params) => {
        record('billingPortal.sessions.create', params);
        if (!state.customers[params.customer]) throw missing(`customer: '${params.customer}'`);
        return { id: id('bps'), url: `https://billing.stripe.example/p/session/${params.customer}`, return_url: params.return_url };
    };

    // A subscription Stripe knows about (an existing subscriber's).
    const addSubscription = (subId, { status = 'active', price = { id: 'price_legacy', unit_amount: 499 }, customer = 'cus_existing' } = {}) => {
        state.subscriptions[subId] = { id: subId, customer, status, price };
        return subscriptionObject(state.subscriptions[subId]);
    };
    const subscription = (subId) => subscriptionObject(state.subscriptions[subId]);
    // The buyer pays: a subscription's first invoice (the invoice, as invoice.paid carries it) or a PaymentIntent.
    const payInvoice = (invoiceId) => {
        const inv = state.invoices[invoiceId];
        Object.assign(inv, { status: 'paid', amount_paid: inv.amount_due });
        state.intents[inv.intent].status = 'succeeded';
        return invoicePayload(inv);
    };
    const setIntent = (piId, fields) => Object.assign(state.intents[piId], fields);
    const invoiceOf = (subId) => state.invoices[state.subscriptions[subId].latest_invoice];
    const invoiceEvent = (subId) => invoicePayload(invoiceOf(subId));

    // Delivers a Stripe event to the webhook, signed as Stripe signs it.
    const deliver = (app, type, object, eventId = id('evt')) => {
        const event = { id: eventId, object: 'event', type, data: { object } };
        const payload = JSON.stringify(event);
        const signature = client.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
        return app.request('POST', '/api/v1/payment/stripe/charge-intent/webhooks', { body: event, headers: { 'stripe-signature': signature } });
    };

    const callsOf = (name) => calls.filter((c) => c.name === name);
    return { client, calls, callsOf, state, addSubscription, subscription, payInvoice, setIntent, invoiceOf, invoiceEvent, deliver, stripeError };
};

// Waits until `check()` is true (an email sent after the answer, say); fails after `ms`.
const eventually = async (check, ms = 2000) => {
    const end = Date.now() + ms;
    while (!(await check())) {
        if (Date.now() > end) throw new Error('Timed out waiting');
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
};

module.exports = { installFakeStripe, eventually, WEBHOOK_SECRET };
