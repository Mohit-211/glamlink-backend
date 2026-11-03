const { Op } = require('sequelize');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const sequelize = require('../../core/db/central.db');
const config = require('../../core/config/config');
const logger = require('../../core/logger');
const { allowedOrigins } = require('../../core/http/cors');
const { stripe } = require('../../integrations/stripe');
const { AccessSubscription, AccessPriceOverride, AccessProduct, User } = require('../../models');
const { seatOf, isPro, isPastDue, saveSeatFromStripe, syncLegacyFields, PRO_STATUSES } = require('./seats');
const { ensureListPrice, ensureStripeProduct } = require('./stripeCatalog');
const { stripeUnavailable, isMissing } = require('./stripeErrors');

// Managing seats (docs/access.md sections 4 and 6): cancel at the end of the paid month or now, resume, give or
// take back complimentary Pro, move subscribers to a new price, end Pro with a deleted account, and Stripe's billing
// portal (the card on file, invoices). Nothing here refunds: a refund is made by hand in Stripe's dashboard.

const notFound = () => ApiError.withCode(httpStatus.NOT_FOUND, 'No Access Pro subscription.', 'NO_SUBSCRIPTION');

// Stripe subscriptions that are over.
const ENDED = ['canceled', 'incomplete_expired'];

/**
 * The seat as the website shows it. `pro`: Access Pro now. `past_due`: a payment of the subscription failed and is not
 * settled (Stripe is retrying it, or has stopped); the person keeps Pro while `pro` says so, at most 21 days after the
 * first failure (seats.js), and pays from the billing portal. `last_payment_failed_at`: the latest failed payment.
 */
const seatView = (seat) => seat && {
    status: seat.status,
    pro: isPro(seat),
    past_due: isPastDue(seat),
    last_payment_failed_at: seat.last_payment_failed_at,
    source: seat.source,
    amount_cents: seat.amount_cents,
    current_period_end: seat.current_period_end,
    cancel_at_period_end: seat.cancel_at_period_end,
    canceled_at: seat.canceled_at,
    started_at: seat.started_at,
};

const saveFromStripe = (userId, subscription) =>
    sequelize.transaction((transaction) => saveSeatFromStripe(userId, subscription, transaction));

/**
 * Ends a Stripe subscription now: no proration, no refund, no final invoice. The seat that has it follows; one whose
 * subscription Stripe no longer knows (a test copy of live data) is ended here. Returns that seat, or null.
 */
const endSubscriptionNow = async (subscriptionId) => {
    let subscription = null;
    try {
        subscription = await stripe().subscriptions.cancel(subscriptionId, { prorate: false, invoice_now: false });
    } catch (err) {
        if (!isMissing(err)) {
            // Already over (cancelled, or expired before its first payment): Stripe will not cancel it again.
            const current = await stripe().subscriptions.retrieve(subscriptionId).catch(() => null);
            if (!current || !ENDED.includes(current.status)) throw err;
            subscription = current;
        }
    }
    const seat = await AccessSubscription.findOne({ where: { stripe_subscription_id: subscriptionId } });
    if (!seat) return null;
    if (subscription) return saveFromStripe(seat.user_id, subscription);
    await seat.update({ status: 'canceled', canceled_at: seat.canceled_at || new Date(), ended_at: new Date() });
    await syncLegacyFields(seat.user_id);
    return seatOf(seat.user_id);
};

// A seat that can still be cancelled: Pro, or a Stripe subscription still running (past due beyond its grace, unpaid).
const cancellable = (seat) => Boolean(seat && (isPro(seat) || (seat.stripe_subscription_id && !ENDED.includes(seat.status))));

/**
 * Cancels a person's Access Pro: by default at the end of the month they paid for (they stay Pro until then and
 * can resume); `now` ends it at once, without proration or refund. A complimentary seat ends at once.
 */
const cancelSeat = async (userId, { now = false } = {}) => {
    const seat = await seatOf(userId);
    if (!cancellable(seat)) throw notFound();
    if (seat.source === 'comp' || !seat.stripe_subscription_id) {
        await seat.update({ status: 'canceled', canceled_at: new Date(), ended_at: new Date() });
        await syncLegacyFields(userId);
        return seatOf(userId);
    }
    try {
        if (now) return await endSubscriptionNow(seat.stripe_subscription_id);
        const subscription = await stripe().subscriptions.update(seat.stripe_subscription_id, { cancel_at_period_end: true });
        return await saveFromStripe(userId, subscription);
    } catch (err) {
        throw stripeUnavailable(err, `Cancelling the Access Pro of user ${userId}`);
    }
};

// Takes back a cancellation planned for the end of the period.
const resumeSeat = async (userId) => {
    const seat = await seatOf(userId);
    if (!seat || !isPro(seat) || !seat.stripe_subscription_id) throw notFound();
    if (!seat.cancel_at_period_end) return seat;
    try {
        const subscription = await stripe().subscriptions.update(seat.stripe_subscription_id, { cancel_at_period_end: false });
        return await saveFromStripe(userId, subscription);
    } catch (err) {
        throw stripeUnavailable(err, `Resuming the Access Pro of user ${userId}`);
    }
};

/**
 * An account is being deleted (shared billing's endBillingOf, an admin's delete or the person's own): its Access Pro
 * ends now, without proration or refund, so Stripe never charges it again (BE-15). Complimentary Pro just ends.
 */
const endSeatOfClosedAccount = async (userId) => {
    const seat = await seatOf(userId);
    if (!seat || ENDED.includes(seat.status)) return;
    if (seat.stripe_subscription_id) {
        await endSubscriptionNow(seat.stripe_subscription_id);
    } else {
        await seat.update({ status: 'canceled', canceled_at: new Date(), ended_at: new Date() });
    }
    logger.info(`Access Pro of user ${userId} ended with their account`);
};

// Complimentary Pro (no payment), given or taken back by an admin. A person who pays keeps their subscription.
const setComp = async (userId, active) => {
    const user = await User.findByPk(userId, { attributes: ['id'] });
    if (!user) throw new ApiError(httpStatus.NOT_FOUND, 'User not found.');
    const seat = await seatOf(userId);
    if (seat?.source === 'stripe' && isPro(seat)) {
        throw ApiError.withCode(httpStatus.CONFLICT, 'This person pays for Access Pro; cancel that subscription instead.', 'SUBSCRIPTION_PAID');
    }
    const fields = active
        ? { source: 'comp', status: 'active', stripe_subscription_id: null, amount_cents: null, current_period_end: null, cancel_at_period_end: false, started_at: new Date(), canceled_at: null, ended_at: null, past_due_since: null }
        : { status: 'canceled', canceled_at: new Date(), ended_at: new Date() };
    if (seat) await seat.update(fields);
    else if (active) await AccessSubscription.create({ user_id: userId, ...fields });
    await syncLegacyFields(userId);
    return seatOf(userId);
};

// The subscription item of a seat (one item: Access Pro).
const itemOf = async (seat) => {
    const subscription = await stripe().subscriptions.retrieve(seat.stripe_subscription_id);
    return { subscription, item: subscription.items.data[0] };
};

/**
 * Moves every paying subscriber without a personal price to a product's new list price, from their next
 * renewal (no proration). Only on an admin's request (the price screen's move_subscribers). Returns { moved, failed }.
 */
const moveSubscribersToListPrice = async (product) => {
    const priceId = await ensureListPrice(product);
    const personal = await AccessPriceOverride.findAll({ where: { product_code: product.code, ended_at: null, user_id: { [Op.ne]: null } }, attributes: ['user_id'] });
    const exempt = new Set(personal.map((o) => String(o.user_id)));
    const seats = await AccessSubscription.findAll({ where: { source: 'stripe', status: { [Op.in]: PRO_STATUSES }, stripe_subscription_id: { [Op.ne]: null } } });
    let moved = 0;
    const failed = [];
    for (const seat of seats.filter((s) => !exempt.has(String(s.user_id)))) {
        try {
            const { item } = await itemOf(seat);
            if (item.price.id === priceId) continue;
            const subscription = await stripe().subscriptions.update(seat.stripe_subscription_id, {
                items: [{ id: item.id, price: priceId }],
                proration_behavior: 'none',
            });
            await saveFromStripe(seat.user_id, subscription);
            moved += 1;
        } catch (err) {
            logger.error(`Moving seat ${seat.id} to price ${priceId}`, err);
            failed.push({ user_id: seat.user_id, error: err.message });
        }
    }
    return { moved, failed };
};

// A personal price on a paying subscriber's live subscription, from their next renewal (no proration).
const applyPersonalPrice = async (override) => {
    if (override.product_code !== 'pro' || !override.user_id) return null;
    const seat = await seatOf(override.user_id);
    if (!seat || seat.source !== 'stripe' || !isPro(seat)) return null;
    const product = await AccessProduct.findOne({ where: { code: 'pro' } });
    const { item } = await itemOf(seat);
    const subscription = await stripe().subscriptions.update(seat.stripe_subscription_id, {
        items: [{
            id: item.id,
            price_data: {
                currency: 'usd',
                product: await ensureStripeProduct(product),
                unit_amount: override.amount_cents,
                recurring: { interval: product.billing_interval || 'month' },
            },
        }],
        proration_behavior: 'none',
    });
    return saveFromStripe(seat.user_id, subscription);
};

const listSeats = ({ status, source } = {}) => {
    const where = {};
    if (status) where.status = status;
    if (source) where.source = source;
    return AccessSubscription.findAll({
        where,
        order: [['updated_at', 'DESC']],
        limit: 1000,
    });
};

// Where Stripe's billing portal may send the person back: a page of the website (WEBSITE_URL), or of an origin allowed
// to call the API (ACCESSDOMAINS). The dashboard when none is given.
const portalReturnUrl = (value) => {
    if (value === undefined || value === null || value === '') return `${config.WEBSITE_URL}/dashboard`;
    let url = null;
    try {
        url = new URL(String(value));
    } catch {
        url = null;
    }
    const origins = [new URL(config.WEBSITE_URL).origin, ...allowedOrigins];
    if (!url || !['http:', 'https:'].includes(url.protocol) || !origins.includes(url.origin)) {
        throw ApiError.withCode(httpStatus.BAD_REQUEST, 'return_url must be a page of the website.', 'INVALID_INPUT', { field: 'return_url' });
    }
    return url.toString();
};

const noCustomer = () => ApiError.withCode(httpStatus.NOT_FOUND, 'You have no billing account yet.', 'NO_CUSTOMER');

/**
 * A session of Stripe's billing portal for a person: the card on file (to pay a failed renewal), invoices, cancelling,
 * as set up in Stripe's dashboard. Answers { url }; NO_CUSTOMER when they have never paid through Stripe here (or
 * Stripe does not know their customer).
 */
const billingPortalFor = async (userId, returnUrl) => {
    const url = portalReturnUrl(returnUrl);
    const [seat, user] = await Promise.all([seatOf(userId), User.findByPk(userId, { attributes: ['id', 'stripe_customer_id'] })]);
    const customer = seat?.stripe_customer_id || user?.stripe_customer_id;
    if (!customer) throw noCustomer();
    try {
        const session = await stripe().billingPortal.sessions.create({ customer, return_url: url });
        return { url: session.url };
    } catch (err) {
        if (isMissing(err)) throw noCustomer();
        throw stripeUnavailable(err, `Billing portal for user ${userId}`);
    }
};

module.exports = {
    seatView, cancelSeat, resumeSeat, endSubscriptionNow, endSeatOfClosedAccount, setComp, moveSubscribersToListPrice,
    applyPersonalPrice, listSeats, billingPortalFor,
};
