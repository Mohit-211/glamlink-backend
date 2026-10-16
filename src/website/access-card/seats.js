const { BusinessCard, User, AccessSubscription } = require('../../models');

// A person's Access Pro subscription, their seat (docs/access.md section 4): one per person, kept when they
// delete and re-create their card. A seat paid through Stripe follows its Stripe subscription; a complimentary
// one ('comp') is given by an admin.

// Pro while the subscription is active, on trial, or past due (Stripe is retrying the payment).
const PRO_STATUSES = ['active', 'trialing', 'past_due'];

const seatOf = (userId, options = {}) => AccessSubscription.findOne({ where: { user_id: userId }, ...options });
const isPro = (seat) => Boolean(seat && PRO_STATUSES.includes(seat.status));

// Whether the person bought the keychain (on any of their cards, deleted ones too).
const ownsKeychain = async (userId, transaction) => Boolean(await BusinessCard.findOne({
    where: { user_id: userId, nfc_status: 'paid' },
    attributes: ['id'],
    paranoid: false,
    transaction,
}));

// A card's plan fields (still read by the website) from its owner's seat and keychain.
const planFieldsFor = async (user, transaction) => {
    const [seat, keychain] = await Promise.all([seatOf(user.id, { transaction }), ownsKeychain(user.id, transaction)]);
    const pro = isPro(seat);
    return {
        nfc_status: keychain ? 'paid' : 'not_purchased',
        plan_type: pro ? (keychain ? 'nfc_with_subscription' : 'subscription_only') : keychain ? 'nfc_only' : 'free',
    };
};

// users.subscription_status as the website reads it.
const legacyStatus = (seat) => {
    if (!seat) return 'INACTIVE';
    if (PRO_STATUSES.includes(seat.status)) return 'ACTIVE';
    if (seat.status === 'incomplete') return 'PENDING';
    if (['canceled', 'incomplete_expired'].includes(seat.status)) return 'CANCELLED';
    return 'INACTIVE';
};

// Copies a seat to the fields the website still reads: the account's subscription fields and the live card's plan.
const syncLegacyFields = async (userId, transaction) => {
    const seat = await seatOf(userId, { transaction });
    await User.update({
        subscription_status: legacyStatus(seat),
        stripe_subscription_id: seat?.stripe_subscription_id ?? null,
        subscription_started_at: seat?.started_at ?? null,
        subscription_renewal_at: seat?.current_period_end ?? null,
        subscription_cancelled_at: seat?.canceled_at ?? null,
    }, { where: { id: userId }, transaction });
    const card = await BusinessCard.findOne({ where: { user_id: userId }, transaction });
    if (card) await card.update(await planFieldsFor({ id: userId }, transaction), { transaction });
};

const secondsToDate = (seconds) => (seconds ? new Date(seconds * 1000) : null);

// A seat's fields from a Stripe subscription (API 2026-09-30: the period end is on the subscription item).
const seatFieldsFrom = (subscription) => {
    const item = subscription.items?.data?.[0];
    return {
        source: 'stripe',
        status: subscription.status,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null,
        amount_cents: item?.price?.unit_amount ?? null,
        currency: subscription.currency || 'usd',
        current_period_end: secondsToDate(item?.current_period_end),
        cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
        started_at: secondsToDate(subscription.start_date),
        canceled_at: secondsToDate(subscription.canceled_at),
        ended_at: secondsToDate(subscription.ended_at),
    };
};

// The person's seat from their Stripe subscription: made or updated, then copied to the legacy fields.
const saveSeatFromStripe = async (userId, subscription, transaction) => {
    const fields = seatFieldsFrom(subscription);
    const seat = await seatOf(userId, { transaction });
    if (seat) await seat.update(fields, { transaction });
    else await AccessSubscription.create({ user_id: userId, ...fields }, { transaction });
    await syncLegacyFields(userId, transaction);
    return seatOf(userId, { transaction });
};

module.exports = {
    PRO_STATUSES,
    seatOf,
    isPro,
    ownsKeychain,
    planFieldsFor,
    legacyStatus,
    syncLegacyFields,
    seatFieldsFrom,
    saveSeatFromStripe,
};
