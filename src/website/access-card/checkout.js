const { Op } = require('sequelize');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const sequelize = require('../../core/db/central.db');
const config = require('../../core/config/config');
const { stripe } = require('../../integrations/stripe');
const { AccessPlan, AccessProduct, AccessCheckout, BusinessCard, User } = require('../../models');
const { assertNoAccountFor } = require('./cardOwnership');
const { seatOf, isPro, ownsKeychain } = require('./seats');
const catalog = require('./catalog');
const { ensureStripeProduct, ensureListPrice, ensureCoupon, productByCode } = require('./stripeCatalog');
const { quoteShipping } = require('./shipping');

// Buying Access (docs/access.md sections 5 and 6). A checkout quotes a plan for a card: the products the person
// still needs, at their price (personal price, else the list price less the running sale), plus shipping for the
// keychain. The quote is stored, then paid through Stripe: a Subscription when it includes Access Pro (the keychain
// and shipping are one-off items on its first invoice), a PaymentIntent for the keychain alone. The browser never
// sends an amount, and a checkout is paid at the prices it quoted.

const CHECKOUT_HOURS = 24;
const conflict = (message, code, details) => ApiError.withCode(httpStatus.CONFLICT, message, code, details);
const badRequest = (message, code, details) => ApiError.withCode(httpStatus.BAD_REQUEST, message, code, details);

// The old purchase calls' names for what was bought (payments.payment_type, the emails).
const purchaseType = (lines) => {
    const pro = lines.some((line) => line.kind === 'subscription');
    const keychain = lines.some((line) => line.product === 'keychain');
    if (pro && keychain) return 'NFC_WITH_SUBSCRIPTION';
    return pro ? 'SUBSCRIPTION_ONLY' : 'NFC_ONLY';
};

/**
 * Quotes a plan for a card. `user` is the signed-in caller (the card's owner) or null for a guest holding the
 * card token (the route checks which). `rateId` picks a shipping option; the cheapest is chosen otherwise.
 * An open checkout for the same card is reused. Returns the checkout.
 */
const quote = async ({ card, planCode, rateId }) => {
    const plan = await AccessPlan.findOne({ where: { code: planCode || '', is_active: true } });
    if (!plan) throw badRequest('Invalid plan type', 'INVALID_PLAN');
    if (!plan.products.length) throw badRequest('This plan is free: choose it with select-plan.', 'PLAN_IS_FREE');
    await assertNoAccountFor(card);

    const owner = card.user_id ? await User.findByPk(card.user_id, { attributes: ['id', 'email'] }) : null;
    const settings = await catalog.getSettings();
    const products = await AccessProduct.findAll({ where: { code: plan.products, is_active: true } });

    // What the person already has is not sold again; the rest in the plan's order.
    const seat = owner ? await seatOf(owner.id) : null;
    const keychainOwned = owner ? await ownsKeychain(owner.id) : card.nfc_status === 'paid';
    const toBuy = products
        .filter((product) => !(product.kind === 'subscription' && isPro(seat)))
        .sort((a, b) => plan.products.indexOf(a.code) - plan.products.indexOf(b.code));
    if (toBuy.some((product) => product.code === 'keychain') && keychainOwned && settings.keychains_per_person <= 1) {
        throw badRequest('NFC card already purchased', 'NFC_ALREADY_PURCHASED');
    }
    if (!toBuy.length) throw conflict('You already have this plan.', 'ALREADY_OWNED');

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
    const open = await AccessCheckout.findOne({ where: { business_card_id: card.id, status: 'open' }, order: [['id', 'DESC']] });
    if (open) return open.update(fields);
    return AccessCheckout.create({ ...fields, status: 'open' });
};

// The quote as the website shows it.
const view = (checkout) => ({
    checkout_id: checkout.id,
    status: checkout.status,
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
});

// The person's Stripe customer: their account's, else one made for the guest's email.
const customerFor = async (checkout, card, transaction) => {
    if (checkout.stripe_customer_id) return checkout.stripe_customer_id;
    const owner = checkout.user_id ? await User.findByPk(checkout.user_id, { attributes: ['id', 'email', 'stripe_customer_id'], transaction }) : null;
    if (owner?.stripe_customer_id) return owner.stripe_customer_id;
    const customer = await stripe().customers.create({
        email: owner?.email || checkout.email,
        name: card.name || undefined,
        phone: card.phone || undefined,
        metadata: { ...(owner && { user_id: String(owner.id) }), business_card_id: String(card.id) },
    }, { idempotencyKey: `glamlink-checkout-${checkout.id}-customer` });
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

/**
 * Pays a checkout: makes the Stripe Subscription or PaymentIntent and returns the client secret for Stripe.js
 * (confirmPayment, or confirmCardPayment). Paying again while it is pending gives the same secret.
 */
const pay = async (checkoutId) => {
    const checkout = await sequelize.transaction(async (transaction) => {
        const row = await AccessCheckout.findByPk(checkoutId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!row) throw new ApiError(httpStatus.NOT_FOUND, 'Checkout not found.');
        if (row.status === 'pending' && row.client_secret) return row;
        if (row.status === 'paid') throw conflict('This checkout is already paid.', 'ALREADY_PAID');
        if (row.status !== 'open' || row.expires_at < new Date()) {
            if (row.status === 'open') await row.update({ status: 'expired' }, { transaction });
            throw conflict('This checkout has expired. Please start again.', 'CHECKOUT_EXPIRED');
        }
        const card = await BusinessCard.findByPk(row.business_card_id, { transaction });
        if (!card) throw new ApiError(httpStatus.NOT_FOUND, 'Business card not found');
        await assertNoAccountFor(card);

        const customer = await customerFor(row, card, transaction);
        const subscriptionLine = row.lines.find((line) => line.kind === 'subscription');
        const oneOff = row.lines.filter((line) => line.kind !== 'subscription');
        const metadata = metadataOf(row);
        const idempotencyKey = `glamlink-checkout-${row.id}`;
        let ids;

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
                payment_settings: { save_default_payment_method: 'on_subscription' },
                billing_mode: { type: 'flexible' },
                expand: ['latest_invoice.confirmation_secret'],
                metadata,
            }, { idempotencyKey });
            const invoice = subscription.latest_invoice;
            ids = {
                stripe_subscription_id: subscription.id,
                stripe_invoice_id: invoice?.id || null,
                client_secret: invoice?.confirmation_secret?.client_secret || null,
            };
        } else {
            const intent = await stripe().paymentIntents.create({
                amount: row.total_cents,
                currency: 'usd',
                customer,
                automatic_payment_methods: { enabled: true },
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
            ids = { stripe_payment_intent_id: intent.id, client_secret: intent.client_secret };
        }
        if (!ids.client_secret) throw new Error(`Stripe returned no client secret for checkout ${row.id}`);
        await row.update({ ...ids, stripe_customer_id: customer, status: 'pending' }, { transaction });
        return row;
    });
    return {
        checkout_id: checkout.id,
        client_secret: checkout.client_secret,
        publishable_key: config.STRIPE_PUBLISHABLE_KEY,
        amount_cents: checkout.total_cents,
        stripe_customer_id: checkout.stripe_customer_id,
        stripe_subscription_id: checkout.stripe_subscription_id,
        // A PaymentIntent's id is the start of its client secret (an invoice's secret is one too).
        payment_intent_id: checkout.stripe_payment_intent_id || String(checkout.client_secret).split('_secret_')[0],
    };
};

// The newest checkout of a card, open or waiting for Stripe, for the old purchase calls.
const latestFor = (cardId, planCode) => AccessCheckout.findOne({
    where: { business_card_id: cardId, plan_code: planCode, status: { [Op.in]: ['open', 'pending'] }, expires_at: { [Op.gt]: new Date() } },
    order: [['id', 'DESC']],
});

module.exports = { quote, view, pay, latestFor, purchaseType, CHECKOUT_HOURS };
