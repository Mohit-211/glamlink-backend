const { Op } = require('sequelize');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const sequelize = require('../../core/db/central.db');
const logger = require('../../core/logger');
const { stripe } = require('../../integrations/stripe');
const { AccessSubscription, AccessPriceOverride, AccessProduct, User } = require('../../models');
const { seatOf, isPro, saveSeatFromStripe, syncLegacyFields, PRO_STATUSES } = require('./seats');
const { ensureListPrice, ensureStripeProduct } = require('./stripeCatalog');

// Managing seats (docs/access.md sections 4 and 6): cancel at the end of the paid month or now, resume, give or
// take back complimentary Pro, and move subscribers to a new price.

const notFound = () => ApiError.withCode(httpStatus.NOT_FOUND, 'No Access Pro subscription.', 'NO_SUBSCRIPTION');

const seatView = (seat) => seat && {
    status: seat.status,
    pro: isPro(seat),
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
 * Cancels a person's Access Pro: by default at the end of the month they paid for (they stay Pro until then and
 * can resume); `now` ends it at once. A complimentary seat ends at once.
 */
const cancelSeat = async (userId, { now = false } = {}) => {
    const seat = await seatOf(userId);
    if (!seat || !isPro(seat)) throw notFound();
    if (seat.source === 'comp' || !seat.stripe_subscription_id) {
        await seat.update({ status: 'canceled', canceled_at: new Date(), ended_at: new Date() });
        await syncLegacyFields(userId);
        return seatOf(userId);
    }
    const subscription = now
        ? await stripe().subscriptions.cancel(seat.stripe_subscription_id)
        : await stripe().subscriptions.update(seat.stripe_subscription_id, { cancel_at_period_end: true });
    return saveFromStripe(userId, subscription);
};

// Takes back a cancellation planned for the end of the period.
const resumeSeat = async (userId) => {
    const seat = await seatOf(userId);
    if (!seat || !isPro(seat) || !seat.stripe_subscription_id) throw notFound();
    if (!seat.cancel_at_period_end) return seat;
    const subscription = await stripe().subscriptions.update(seat.stripe_subscription_id, { cancel_at_period_end: false });
    return saveFromStripe(userId, subscription);
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
        ? { source: 'comp', status: 'active', stripe_subscription_id: null, amount_cents: null, current_period_end: null, cancel_at_period_end: false, started_at: new Date(), canceled_at: null, ended_at: null }
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
 * renewal (no proration). Returns { moved, failed }.
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

module.exports = { seatView, cancelSeat, resumeSeat, setComp, moveSubscribersToListPrice, applyPersonalPrice, listSeats };
