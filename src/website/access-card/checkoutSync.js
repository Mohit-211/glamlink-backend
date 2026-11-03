const { Op } = require('sequelize');
const logger = require('../../core/logger');
const { stripe } = require('../../integrations/stripe');
const { AccessCheckout } = require('../../models');
const { activate, idOf } = require('./payments');
const { isStripeError } = require('./stripeErrors');

// Asking Stripe what became of a checkout's payment (BE-01), so a paid card goes live even when the webhook is late,
// failing or lost: the checkout poll (GET /access/checkout/:id), /pay and the quote ask about the checkout in hand, and
// a sweeper job asks about every checkout still waiting. activate() runs once per checkout, whoever comes first.

// The poll asks Stripe about one checkout at most this often (the website asks every second or two).
const SYNC_EVERY_MS = 3000;
// The sweeper looks at checkouts made at least this long ago, each at most this often.
const SWEEP_AFTER_MS = 10 * 60e3;
const SWEEP_EVERY_MS = 5 * 60e3;

const WAITING = ['pending', 'processing'];

// Moves a checkout from one status to another, unless something else moved it first.
const move = (checkout, from, to) => AccessCheckout.update({ status: to }, { where: { id: checkout.id, status: from } });

// A PaymentIntent's state: paid, processing (the bank is confirming), gone (cancelled), failed (the last attempt was
// declined; it can be paid again), or payable (waiting for the buyer: a payment method, 3-D Secure).
const stateOfIntent = (intent) => {
    switch (intent?.status) {
        case 'succeeded': return 'paid';
        case 'processing': return 'processing';
        case 'canceled': return 'gone';
        case 'requires_payment_method': return intent.last_payment_error ? 'failed' : 'payable';
        default: return 'payable';
    }
};

/**
 * Where the payment of a checkout stands at Stripe: { state, invoice?, intent? }. A subscription's first invoice is
 * paid, or void (gone), or open with the state of its PaymentIntent; a keychain's PaymentIntent is read directly.
 */
const paymentOf = async (checkout) => {
    if (checkout.stripe_subscription_id) {
        const invoiceId = checkout.stripe_invoice_id
            || idOf((await stripe().subscriptions.retrieve(checkout.stripe_subscription_id)).latest_invoice);
        if (!invoiceId) return { state: 'payable' };
        const invoice = await stripe().invoices.retrieve(invoiceId, { expand: ['payments.data.payment.payment_intent'] });
        if (invoice.status === 'paid') return { state: 'paid', invoice };
        if (['void', 'uncollectible'].includes(invoice.status)) return { state: 'gone' };
        const payments = invoice.payments?.data || [];
        const intent = (payments.find((p) => p.is_default) || payments[0])?.payment?.payment_intent;
        return { state: stateOfIntent(typeof intent === 'object' ? intent : null) };
    }
    if (checkout.stripe_payment_intent_id) {
        const intent = await stripe().paymentIntents.retrieve(checkout.stripe_payment_intent_id);
        return { state: stateOfIntent(intent), intent };
    }
    return { state: 'payable' };
};

/**
 * Asks Stripe about a checkout waiting for its payment (pending or processing) and acts on the answer: a paid one is
 * activated, one the bank is confirming is marked processing (pending again if the bank refused), one Stripe gave up
 * on expires. Without `force`, a checkout asked about a moment ago is not asked again. Returns { checkout (as it is
 * now), state } (paymentOf's state; null when Stripe was not asked).
 */
const syncCheckout = async (checkout, { force = false } = {}) => {
    if (!WAITING.includes(checkout.status)) return { checkout, state: null };
    if (!force && checkout.synced_at && Date.now() - new Date(checkout.synced_at).getTime() < SYNC_EVERY_MS) return { checkout, state: null };
    await AccessCheckout.update({ synced_at: new Date() }, { where: { id: checkout.id } });
    const payment = await paymentOf(checkout);
    if (payment.state === 'paid') await activate(checkout.id, payment.invoice ? { invoice: payment.invoice } : { intent: payment.intent });
    else if (payment.state === 'processing') await move(checkout, 'pending', 'processing');
    else if (payment.state === 'gone') await move(checkout, WAITING, 'expired');
    else await move(checkout, 'processing', 'pending');
    return { checkout: await checkout.reload(), state: payment.state };
};

// A subscription whose first invoice is unpaid: the invoice is voided first, so that it can never be paid, then the
// subscription cancelled. Should Stripe refuse the void while the subscription is incomplete, and the invoice is still
// unpaid, the subscription is cancelled first and the invoice voided after.
const stopSubscription = async (checkout) => {
    const voidInvoice = async () => {
        if (checkout.stripe_invoice_id) await stripe().invoices.voidInvoice(checkout.stripe_invoice_id);
    };
    const cancel = () => stripe().subscriptions.cancel(checkout.stripe_subscription_id, { prorate: false, invoice_now: false });
    try {
        await voidInvoice();
    } catch (err) {
        if (!isStripeError(err) || !['payable', 'failed'].includes((await paymentOf(checkout)).state)) throw err;
        await cancel();
        await voidInvoice();
        return;
    }
    await cancel();
};

/**
 * Stops a checkout's payment at Stripe so that it can never be paid (a newer quote replaces it, or it waited too long):
 * its PaymentIntent is cancelled, or its subscription's first invoice voided and the subscription cancelled (nothing
 * was paid, so nothing is refunded). Then the checkout is marked `status` (cancelled or expired). When Stripe has taken
 * the payment meanwhile, or is taking it, nothing is stopped and false is returned.
 */
const stopCheckout = async (checkout, status) => {
    try {
        if (checkout.stripe_payment_intent_id) await stripe().paymentIntents.cancel(checkout.stripe_payment_intent_id);
        else if (checkout.stripe_subscription_id) await stopSubscription(checkout);
    } catch (err) {
        if (!isStripeError(err)) throw err;
        // Refused: already stopped (fine), or paid or being paid.
        const { state } = await paymentOf(checkout);
        if (state !== 'gone') {
            logger.warn(`Checkout ${checkout.id} could not be stopped at Stripe (${state}): ${err.message}`);
            return false;
        }
    }
    await move(checkout, ['open', ...WAITING], status);
    return true;
};

/**
 * The sweeper (every five minutes, src/jobs.js; off with JOBS_ENABLED=false): every checkout still waiting for Stripe
 * ten minutes after it was made is asked about, so a paid card goes live although its webhook never came; one still
 * unpaid after its payment window (expires_at) is stopped at Stripe and expires. Returns how many were looked at.
 */
const sweepCheckouts = async (now = new Date()) => {
    const waiting = await AccessCheckout.findAll({
        where: {
            status: { [Op.in]: WAITING },
            created_at: { [Op.lt]: new Date(now.getTime() - SWEEP_AFTER_MS) },
            [Op.or]: [{ synced_at: null }, { synced_at: { [Op.lt]: new Date(now.getTime() - SWEEP_EVERY_MS) } }],
        },
        order: [['id', 'ASC']],
        limit: 50,
    });
    for (const checkout of waiting) {
        try {
            const { checkout: synced, state } = await syncCheckout(checkout, { force: true });
            if (['payable', 'failed'].includes(state) && synced.expires_at < now) await stopCheckout(synced, 'expired');
        } catch (err) {
            logger.error(`Asking Stripe about Access checkout ${checkout.id}`, err);
        }
    }
    return waiting.length;
};

module.exports = { syncCheckout, stopCheckout, sweepCheckouts, paymentOf, SYNC_EVERY_MS };
