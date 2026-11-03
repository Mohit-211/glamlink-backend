const crypto = require('crypto');
const { Op } = require('sequelize');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const sequelize = require('../../core/db/central.db');
const config = require('../../core/config/config');
const { stripe } = require('../../integrations/stripe');
const { AccessPlan, AccessProduct, AccessCheckout, BusinessCard, User } = require('../../models');
const { assertNoAccountFor } = require('./cardOwnership');
const { seatOf, isPro, keychainsOf } = require('./seats');
const catalog = require('./catalog');
const { ensureStripeProduct, ensureListPrice, ensureCoupon, productByCode } = require('./stripeCatalog');
const { quoteShipping, shippingAddressOf } = require('./shipping');
const { activate, purchaseType } = require('./payments');
const { syncCheckout, stopCheckout } = require('./checkoutSync');
const { stripeUnavailable, isMissing } = require('./stripeErrors');

// Buying Access (docs/access.md sections 5 and 6). A checkout quotes a plan for a card: the products the person
// still needs, at their price (personal price, else the list price less the running sale), plus shipping for the
// keychain. The quote is stored, then paid through Stripe: a Subscription when it includes Access Pro (the keychain
// and shipping are one-off items on its first invoice), a PaymentIntent for the keychain alone. The browser never
// sends an amount, and a checkout is paid at the prices it quoted. A card has one payment under way at a time.

// How long a quote stays open, and then how long its payment waits for the buyer.
const CHECKOUT_HOURS = 24;
// The ways to pay (Nov 1): cards, with Apple Pay and Google Pay (card wallets), and Link. Nothing that settles days
// later (bank debits) or sends the buyer to another site.
const PAYMENT_METHODS = ['card', 'link'];
// Stripe's smallest card payment.
const MIN_CHARGE_CENTS = 50;
const WAITING = ['pending', 'processing'];

const conflict = (message, code, details) => ApiError.withCode(httpStatus.CONFLICT, message, code, details);
const badRequest = (message, code, details) => ApiError.withCode(httpStatus.BAD_REQUEST, message, code, details);
const inProgress = (checkout) =>
    conflict('A payment for this card is already under way.', 'CHECKOUT_IN_PROGRESS', { checkout_id: checkout.id });

// Whether a checkout already paying asks for what a new quote would: the plan, the shipping rate when one is chosen,
// and the card's delivery address as it is now.
const ADDRESS_KEYS = ['name', 'street1', 'street2', 'city', 'state', 'zip', 'country'];
const sameRequest = async (checkout, { card, planCode, rateId }) => {
    if (checkout.plan_code !== planCode) return false;
    if (!checkout.shipping) return true;
    if (rateId && rateId !== checkout.shipping.selected?.rate_id) return false;
    const address = await shippingAddressOf(card).catch(() => null);
    return Boolean(address) && ADDRESS_KEYS.every((key) => (address[key] || null) === (checkout.shipping.address?.[key] || null));
};

/**
 * Quotes a plan for a card (the route checks that the caller is its buyer, owner or an admin). `rateId` picks a
 * shipping option; the cheapest is chosen otherwise. An open checkout for the same card is reused. A payment already
 * under way for the card (BE-02) is looked up at Stripe first: paid or being paid, this answers CHECKOUT_IN_PROGRESS
 * with its checkout_id; still payable, the same request gets that checkout back (pending, with its secret), and another
 * plan, rate or address stops it at Stripe before a new quote is made. Returns the checkout.
 */
const quote = async ({ card, planCode, rateId }) => {
    const plan = await AccessPlan.findOne({ where: { code: planCode || '', is_active: true } });
    if (!plan) throw badRequest('Invalid plan type', 'INVALID_PLAN');
    if (!plan.products.length) throw badRequest('This plan is free: choose it with select-plan.', 'PLAN_IS_FREE');
    await assertNoAccountFor(card);

    const paying = await AccessCheckout.findOne({ where: { business_card_id: card.id, status: { [Op.in]: WAITING } }, order: [['id', 'DESC']] });
    if (paying) {
        try {
            const { checkout } = await syncCheckout(paying, { force: true });
            if (['paid', 'processing'].includes(checkout.status)) throw inProgress(checkout);
            if (checkout.status === 'pending') {
                if (await sameRequest(checkout, { card, planCode: plan.code, rateId })) return checkout;
                if (!(await stopCheckout(checkout, 'cancelled'))) throw inProgress(checkout);
            }
        } catch (err) {
            throw stripeUnavailable(err, `Checking checkout ${paying.id} before a new quote`);
        }
    }

    const owner = card.user_id ? await User.findByPk(card.user_id, { attributes: ['id', 'email'] }) : null;
    const settings = await catalog.getSettings();
    const products = await AccessProduct.findAll({ where: { code: plan.products, is_active: true } });

    // What the person already has is not sold again (Access Pro; the keychain up to the settings' number per person),
    // the rest in the plan's order (BE-31: Pro + keychain with the keychain owned sells Pro alone).
    const seat = owner ? await seatOf(owner.id) : null;
    const keychains = owner ? await keychainsOf(owner.id) : card.nfc_status === 'paid' ? 1 : 0;
    const keychainsFull = keychains >= settings.keychains_per_person;
    const toBuy = products
        .filter((product) => !(product.kind === 'subscription' && isPro(seat)))
        .filter((product) => !(product.code === 'keychain' && keychainsFull))
        .toSorted((a, b) => plan.products.indexOf(a.code) - plan.products.indexOf(b.code));
    if (!toBuy.length) {
        if (keychainsFull && plan.products.every((code) => code === 'keychain')) throw badRequest('NFC card already purchased', 'NFC_ALREADY_PURCHASED');
        throw conflict('You already have this plan.', 'ALREADY_OWNED');
    }

    const now = new Date();
    const discount = await catalog.activeDiscount(now);
    const who = { userId: owner?.id, email: owner?.email || card.email };
    const lines = [];
    for (const product of toBuy) {
        const price = await catalog.priceOf(product, who, { discount, now });
        lines.push({
            product: product.code, name: product.name, kind: product.kind, interval: product.billing_interval,
            list: price.list, amount: price.amount, recurring: price.recurring, personal: price.personal,
            override_id: price.override_id || null, discount_id: price.discount?.id || null,
        });
    }

    let shipping = null;
    if (lines.some((line) => line.product === 'keychain')) {
        const keychainCents = lines.find((line) => line.product === 'keychain').amount;
        const options = await quoteShipping({ card, settings, keychainCents });
        const selected = options.options.find((option) => option.rate_id === rateId) || options.options[0];
        shipping = { address: options.address, shipment_id: options.shipment_id, options: options.options, selected };
    }

    const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
    const shippingCents = shipping ? shipping.selected.amount_cents : 0;
    const recurring = lines.find((line) => line.kind === 'subscription')?.recurring ?? null;
    // A keychain alone is one card payment, and Stripe takes none under 50 cents (nothing to pay needs no payment).
    if (recurring === null && subtotal + shippingCents > 0 && subtotal + shippingCents < MIN_CHARGE_CENTS) {
        throw badRequest('This total is below the smallest card payment ($0.50).', 'AMOUNT_TOO_SMALL');
    }
    const fields = {
        business_card_id: card.id,
        user_id: owner?.id || null,
        email: owner?.email || card.email,
        plan_code: plan.code,
        lines,
        shipping,
        discount_id: lines.find((line) => line.discount_id)?.discount_id || null,
        subtotal_cents: subtotal,
        shipping_cents: shippingCents,
        total_cents: subtotal + shippingCents,
        recurring_cents: recurring,
        expires_at: new Date(now.getTime() + CHECKOUT_HOURS * 3600e3),
    };
    // One quote at a time per card: two at once (a second tab, a double click) update the same open checkout.
    return sequelize.transaction(async (transaction) => {
        await BusinessCard.findByPk(card.id, { attributes: ['id'], transaction, lock: transaction.LOCK.UPDATE });
        const open = await AccessCheckout.findOne({
            where: { business_card_id: card.id, status: 'open' }, order: [['id', 'DESC']], transaction, lock: transaction.LOCK.UPDATE,
        });
        if (open) return open.update(fields, { transaction });
        return AccessCheckout.create({ ...fields, status: 'open' }, { transaction });
    });
};

// The statuses whose client secret the website may still pay with.
const PAYABLE = ['pending', 'failed'];

// open past its time is expired; a pending one whose last attempt Stripe declined (`state` from asking it just now) is
// failed, and can be paid again.
const statusOf = (checkout, state) => {
    if (checkout.status === 'open' && checkout.expires_at < new Date()) return 'expired';
    if (checkout.status === 'pending' && state === 'failed') return 'failed';
    return checkout.status;
};

/**
 * The checkout as the website shows it. `status`: open (quoted: pay it), pending (Stripe waits for the buyer), failed
 * (the last attempt was declined: pay again), processing (the bank is confirming the payment), paid, expired (quote
 * again), or cancelled (a newer quote replaced it, or an admin cancelled its order). `client_secret` while it can be
 * paid (the routes answer only the card's buyer, owner or an admin); `card` once paid. `state`: the payment's state at
 * Stripe when it was just asked (checkoutSync.js).
 */
const view = (checkout, { state = null, card = null } = {}) => {
    const status = statusOf(checkout, state);
    return {
        checkout_id: checkout.id,
        status,
        plan_type: checkout.plan_code,
        lines: checkout.lines,
        shipping: checkout.shipping && {
            address: checkout.shipping.address,
            options: checkout.shipping.options,
            selected: checkout.shipping.selected,
        },
        subtotal_cents: checkout.subtotal_cents,
        shipping_cents: checkout.shipping_cents,
        total_cents: checkout.total_cents,
        monthly_cents: checkout.recurring_cents,
        expires_at: checkout.expires_at,
        paid_at: checkout.paid_at,
        ...(PAYABLE.includes(status) && checkout.client_secret && { client_secret: checkout.client_secret }),
        ...(status === 'paid' && card && {
            card: { business_card_id: card.id, status: card.status, business_card_link: card.business_card_link },
        }),
    };
};

// Stripe's idempotency key for a checkout's request: the checkout and what is asked, so a retry after a failure gets
// the same object, while a checkout quoted again (other lines, another rate) or a rebuilt database reusing its id never
// meets an earlier request's key (BE-14).
const keyFor = (checkout, purpose, ...content) => {
    const digest = crypto.createHash('sha256').update(JSON.stringify([checkout.created_at, ...content])).digest('hex').slice(0, 24);
    return `glamlink-checkout-${checkout.id}-${purpose}-${digest}`;
};

// Whether Stripe still has a customer: one deleted in Stripe, or from the other mode (a test copy of live data), is
// made again (BE-03).
const customerExists = async (id) => {
    try {
        return !(await stripe().customers.retrieve(id)).deleted;
    } catch (err) {
        if (isMissing(err)) return false;
        throw err;
    }
};

// The person's Stripe customer: their account's, else the one an earlier checkout of this card made for the guest's
// email (BE-29), while Stripe still has it; else a new one, kept on the account.
const customerFor = async (checkout, card, transaction) => {
    if (checkout.stripe_customer_id) return checkout.stripe_customer_id;
    const owner = checkout.user_id ? await User.findByPk(checkout.user_id, { attributes: ['id', 'email', 'stripe_customer_id'], transaction }) : null;
    const earlier = owner ? null : await AccessCheckout.findOne({
        where: { business_card_id: card.id, email: checkout.email, stripe_customer_id: { [Op.ne]: null } },
        order: [['id', 'DESC']],
        attributes: ['stripe_customer_id'],
        transaction,
    });
    const known = owner?.stripe_customer_id || earlier?.stripe_customer_id;
    if (known && await customerExists(known)) return known;
    const email = owner?.email || checkout.email;
    const customer = await stripe().customers.create({
        email,
        name: card.name || undefined,
        phone: card.phone || undefined,
        metadata: { ...(owner && { user_id: String(owner.id) }), business_card_id: String(card.id) },
    }, { idempotencyKey: keyFor(checkout, 'customer', email, owner?.id ?? null, known ?? null) });
    if (owner) await User.update({ stripe_customer_id: customer.id }, { where: { id: owner.id }, transaction });
    return customer.id;
};

// Each line's price for Stripe: the list price, or the person's own price (inline), and the sale's coupon.
const stripeLine = async (line, { recurring }) => {
    const product = await productByCode(line.product);
    const discounts = line.discount_id && !line.personal ? [{ coupon: await ensureCoupon(await catalog.discountById(line.discount_id)) }] : undefined;
    if (!line.personal && line.list === product.amount_cents) {
        return { price: await ensureListPrice(product), ...(discounts && { discounts }) };
    }
    // A personal price, or a list price changed since the quote: the quoted amount, inline.
    return {
        price_data: {
            currency: 'usd',
            product: await ensureStripeProduct(product),
            unit_amount: line.personal ? line.amount : line.list,
            ...(recurring && { recurring: { interval: line.interval || 'month' } }),
        },
        ...(discounts && { discounts }),
    };
};

const metadataOf = (checkout) => ({
    access_checkout_id: String(checkout.id),
    business_card_id: String(checkout.business_card_id),
    ...(checkout.user_id && { user_id: String(checkout.user_id) }),
    plan_type: checkout.plan_code,
});

// What /pay answers: the client secret to confirm, or that nothing is left to pay.
const secretAnswer = (checkout) => ({
    checkout_id: checkout.id,
    client_secret: checkout.client_secret,
    publishable_key: config.STRIPE_PUBLISHABLE_KEY,
    amount_cents: checkout.total_cents,
    stripe_customer_id: checkout.stripe_customer_id,
    stripe_subscription_id: checkout.stripe_subscription_id,
    // A PaymentIntent's id is the start of its client secret (an invoice's secret is one too).
    payment_intent_id: checkout.stripe_payment_intent_id || String(checkout.client_secret).split('_secret_')[0],
});
const paidAnswer = (checkout) => ({ paid: true, checkout_id: checkout.id });

// Makes a checkout's Stripe payment (or finds there is nothing to pay), in the checkout's row lock.
const startPayment = (checkoutId) => sequelize.transaction(async (transaction) => {
    const row = await AccessCheckout.findByPk(checkoutId, { transaction, lock: transaction.LOCK.UPDATE });
    if (row.status === 'pending' && row.client_secret) return { row };
    if (row.paid_at || row.status === 'paid') throw conflict('This checkout is already paid.', 'ALREADY_PAID');
    if (row.status !== 'open' || row.expires_at < new Date()) {
        if (row.status === 'open') await row.update({ status: 'expired' }, { transaction });
        throw conflict('This checkout has expired. Please start again.', 'CHECKOUT_EXPIRED');
    }
    const card = await BusinessCard.findByPk(row.business_card_id, { transaction });
    if (!card) throw new ApiError(httpStatus.NOT_FOUND, 'Business card not found');
    await assertNoAccountFor(card);

    const customer = await customerFor(row, card, transaction);
    // From now, the buyer has a day to pay (the sweeper stops the payment after that).
    const pending = { status: 'pending', stripe_customer_id: customer, expires_at: new Date(Date.now() + CHECKOUT_HOURS * 3600e3) };
    const subscriptionLine = row.lines.find((line) => line.kind === 'subscription');
    const oneOff = row.lines.filter((line) => line.kind !== 'subscription');
    // Nothing to pay (the keychain at 100% off with free shipping): no Stripe payment at all.
    if (!subscriptionLine && row.total_cents === 0) {
        await row.update(pending, { transaction });
        return { row, free: true };
    }
    const metadata = metadataOf(row);
    const idempotencyKey = keyFor(row, 'payment', customer, row.plan_code, row.lines, row.shipping?.selected ?? null, row.total_cents, PAYMENT_METHODS);

    if (subscriptionLine) {
        const shippingItem = row.shipping_cents > 0
            ? [{ price_data: { currency: 'usd', product: await ensureStripeProduct(await productByCode('shipping')), unit_amount: row.shipping_cents } }]
            : [];
        const items = [];
        for (const line of oneOff) items.push(await stripeLine(line, { recurring: false }));
        const subscription = await stripe().subscriptions.create({
            customer,
            items: [await stripeLine(subscriptionLine, { recurring: true })],
            add_invoice_items: [...items, ...shippingItem],
            payment_behavior: 'default_incomplete',
            payment_settings: { payment_method_types: PAYMENT_METHODS, save_default_payment_method: 'on_subscription' },
            billing_mode: { type: 'flexible' },
            expand: ['latest_invoice.confirmation_secret'],
            metadata,
        }, { idempotencyKey });
        const invoice = subscription.latest_invoice;
        await row.update({
            ...pending,
            stripe_subscription_id: subscription.id,
            stripe_invoice_id: invoice?.id || null,
            client_secret: invoice?.confirmation_secret?.client_secret || null,
        }, { transaction });
        // A first invoice with nothing to pay (a 100% sale, a $0 personal price): Stripe has marked it paid (BE-07).
        if (invoice?.status === 'paid') return { row, invoice };
        return { row, unpayable: !row.client_secret };
    }
    const intent = await stripe().paymentIntents.create({
        amount: row.total_cents,
        currency: 'usd',
        customer,
        allowed_payment_method_types: PAYMENT_METHODS,
        description: `Glamlink ${row.lines.map((line) => line.name).join(' + ')}`,
        receipt_email: row.email,
        ...(row.shipping && {
            shipping: {
                name: row.shipping.address.name,
                address: {
                    line1: row.shipping.address.street1, line2: row.shipping.address.street2 || undefined,
                    city: row.shipping.address.city, state: row.shipping.address.state,
                    postal_code: row.shipping.address.zip, country: row.shipping.address.country,
                },
            },
        }),
        metadata,
    }, { idempotencyKey });
    await row.update({ ...pending, stripe_payment_intent_id: intent.id, client_secret: intent.client_secret }, { transaction });
    return { row };
});

const payCheckout = async (checkoutId) => {
    const existing = await AccessCheckout.findByPk(checkoutId);
    if (!existing) throw new ApiError(httpStatus.NOT_FOUND, 'Checkout not found.');
    // Waiting for Stripe already: where its payment stands first (a paid one is activated).
    if (WAITING.includes(existing.status)) {
        const { checkout } = await syncCheckout(existing, { force: true });
        if (checkout.status === 'paid') return paidAnswer(checkout);
        if (checkout.status === 'processing') throw inProgress(checkout);
    }
    const made = await startPayment(checkoutId);
    if (made.invoice) {
        await activate(made.row.id, { invoice: made.invoice });
        return paidAnswer(made.row);
    }
    if (made.free) {
        await activate(made.row.id, { intent: { id: `free_${made.row.id}`, amount: 0, amount_received: 0 } });
        return paidAnswer(made.row);
    }
    // Stripe made a subscription it gives no way to pay: it is stopped, never left to bill on its own.
    if (made.unpayable) {
        await stopCheckout(made.row, 'expired');
        throw new Error(`Stripe gave no way to pay the first invoice of checkout ${made.row.id}`);
    }
    return secretAnswer(made.row);
};

/**
 * Pays a checkout: makes the Stripe Subscription or PaymentIntent and answers its client secret for Stripe.js
 * (confirmPayment). Paying again while it is pending gives the same secret, once Stripe has said it is not paid yet;
 * a payment the bank is confirming answers CHECKOUT_IN_PROGRESS. A checkout paid meanwhile, or with nothing to pay (a $0
 * first invoice, a free keychain), answers { paid: true, checkout_id }, activated before the answer. Stripe's own
 * refusals answer 502 PAYMENT_UNAVAILABLE.
 */
const pay = async (checkoutId) => {
    try {
        return await payCheckout(checkoutId);
    } catch (err) {
        throw stripeUnavailable(err, `Paying checkout ${checkoutId}`);
    }
};

// The newest checkout of a card, open or waiting for Stripe, for the old purchase calls.
const latestFor = (cardId, planCode) => AccessCheckout.findOne({
    where: { business_card_id: cardId, plan_code: planCode, status: { [Op.in]: ['open', 'pending'] }, expires_at: { [Op.gt]: new Date() } },
    order: [['id', 'DESC']],
});

module.exports = { quote, view, pay, latestFor, purchaseType, CHECKOUT_HOURS, PAYMENT_METHODS };
