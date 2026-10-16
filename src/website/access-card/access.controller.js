const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const { identify } = require('../../shared/identity');
const { BusinessCard, AccessCheckout } = require('../../models');
const { verifyCardToken, cardTokenFromRequest } = require('./cardToken');
const { claimCard, deleteOwnCard } = require('./cardOwnership');
const catalog = require('./catalog');
const checkoutService = require('./checkout');
const subscriptions = require('./subscriptions');
const { seatOf } = require('./seats');
const fulfillment = require('./fulfillment');

// The Access purchase and card endpoints under /access (docs/access.md).

// A signed-in person takes over the draft they made as a guest; its card token proves they made it.
const claim = catchAsync(async (req, res) => {
    if (!verifyCardToken(cardTokenFromRequest(req), req.params.id)) {
        throw ApiError.withCode(httpStatus.UNAUTHORIZED, 'Send the card token from when this card was made.', 'CARD_TOKEN_REQUIRED');
    }
    const replace = req.body.replace === true || req.body.replace === 'true';
    const card = await claimCard({ user: req.user, cardId: req.params.id, replace });
    return responseWrapper(res, {
        business_card_id: card.id,
        status: card.status,
        plan_type: card.plan_type,
        nfc_status: card.nfc_status,
        business_card_link: card.business_card_link,
        business_card_qr: card.business_card_qr,
    }, 'The card is yours.');
});

// The owner deletes their card; their subscription goes on and their next card keeps its link.
const remove = catchAsync(async (req, res) => {
    const result = await deleteOwnCard({ user: req.user, cardId: req.params.id });
    return responseWrapper(res, result, 'Card deleted.');
});

// The plans priced for whoever asks: a signed-in person, a guest with their draft's card token
// (?business_card_id= and the token), or anyone. A stale sign-in counts as no sign-in here.
const plans = catchAsync(async (req, res) => {
    req.body = req.body || {};
    let user = null;
    try {
        await identify(req);
        user = req.user || null;
    } catch {
        user = null;
    }
    let email = null;
    const cardId = req.query.business_card_id;
    if (!user && cardId && verifyCardToken(cardTokenFromRequest(req), cardId)) {
        email = (await BusinessCard.findByPk(cardId, { attributes: ['email'] }))?.email || null;
    }
    return responseWrapper(res, await catalog.listPlans({ user, email }), '');
});

// ---- Checkout and subscription ------------------------------------------------------------------------------

// Loads the checkout of /checkout/:id for the card access check that follows it.
const loadCheckout = catchAsync(async (req, res, next) => {
    req.checkout = await AccessCheckout.findByPk(req.params.id);
    if (!req.checkout) throw new ApiError(httpStatus.NOT_FOUND, 'Checkout not found.');
    next();
});

// A quote for a plan: the lines, the shipping options (a keychain) and the totals, kept as a checkout.
const quoteCheckout = catchAsync(async (req, res) => {
    const card = await BusinessCard.findOne({ where: { id: req.body.business_card_id, is_active: true } });
    if (!card) throw new ApiError(httpStatus.NOT_FOUND, 'Business card not found');
    const checkout = await checkoutService.quote({ card, planCode: req.body.plan_type, rateId: req.body.rate_id });
    return responseWrapper(res, checkoutService.view(checkout), '');
});

const payCheckout = catchAsync(async (req, res) => responseWrapper(res, await checkoutService.pay(req.checkout.id), ''));
const getCheckout = catchAsync(async (req, res) => responseWrapper(res, checkoutService.view(req.checkout), ''));

const mySubscription = catchAsync(async (req, res) => responseWrapper(res, subscriptions.seatView(await seatOf(req.user.id)), ''));
const cancelMine = catchAsync(async (req, res) => {
    const seat = await subscriptions.cancelSeat(req.user.id, { now: false });
    return responseWrapper(res, subscriptions.seatView(seat), 'Access Pro ends at the end of the month you paid for.');
});
const resumeMine = catchAsync(async (req, res) => {
    const seat = await subscriptions.resumeSeat(req.user.id);
    return responseWrapper(res, subscriptions.seatView(seat), 'Access Pro continues.');
});

// Shippo's webhook (tracking): verified by the token in its URL and, once set up, Shippo's signature over the
// raw body (app.js keeps this path's body raw).
const shippoWebhook = catchAsync(async (req, res) => {
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {});
    if (!fulfillment.isShippoCall(req, raw)) {
        throw ApiError.withCode(httpStatus.UNAUTHORIZED, 'This call is not from Shippo.', 'WEBHOOK_UNVERIFIED');
    }
    let event;
    try {
        event = JSON.parse(raw);
    } catch {
        throw ApiError.withCode(httpStatus.BAD_REQUEST, 'The body is not JSON.', 'INVALID_INPUT');
    }
    await fulfillment.handleShippoEvent(event);
    return res.status(200).json({ received: true });
});

// ---- Admin: plans, prices, discounts, personal prices, settings, subscriptions ---------------------------

const adminId = (req) => req.user?.id || null;
const respond = (fn, message = '') => catchAsync(async (req, res) => responseWrapper(res, await fn(req), message));

const admin = {
    catalog: respond(() => catalog.adminCatalog()),
    updatePlan: respond((req) => catalog.updatePlan(req.params.code, req.body), 'Plan updated.'),
    // A new list price; `move_subscribers` also moves paying subscribers to it from their next renewal.
    changePrice: respond(async (req) => {
        const product = await catalog.changePrice(req.params.code, req.body, adminId(req));
        if (!(req.body.move_subscribers === true || req.body.move_subscribers === 'true')) return { product };
        if (product.kind !== 'subscription') {
            throw ApiError.withCode(httpStatus.BAD_REQUEST, 'Only a subscription price can move subscribers.', 'INVALID_INPUT', { field: 'move_subscribers' });
        }
        const result = await subscriptions.moveSubscribersToListPrice(product);
        await catalog.markSubscribersMoved(product.code);
        return { product, ...result };
    }, 'Price changed.'),
    priceChanges: respond(() => catalog.priceChanges()),
    discounts: respond(() => catalog.listDiscounts()),
    createDiscount: respond((req) => catalog.createDiscount(req.body, adminId(req)), 'Discount created.'),
    updateDiscount: respond((req) => catalog.updateDiscount(req.params.id, req.body), 'Discount updated.'),
    endDiscount: respond((req) => catalog.endDiscount(req.params.id), 'Discount ended.'),
    overrides: respond((req) => catalog.listOverrides(req.query)),
    // A personal price; `apply_now` also puts it on the client's live Access Pro subscription from their next renewal.
    createOverride: respond(async (req) => {
        const override = await catalog.createOverride(req.body, adminId(req));
        const applied = req.body.apply_now === true || req.body.apply_now === 'true'
            ? Boolean(await subscriptions.applyPersonalPrice(override))
            : false;
        return { ...override.toJSON(), applied_to_subscription: applied };
    }, 'Personal price set.'),
    endOverride: respond((req) => catalog.endOverride(req.params.id), 'Personal price ended.'),
    updateSettings: respond((req) => catalog.updateSettings(req.body, adminId(req)), 'Settings saved.'),
    subscriptions: respond((req) => subscriptions.listSeats(req.query)),
    cancelSubscription: respond(
        (req) => subscriptions.cancelSeat(req.params.userId, { now: req.body.now === true || req.body.now === 'true' }),
        'Subscription cancelled.',
    ),
    setComp: respond(
        (req) => subscriptions.setComp(req.params.userId, !(req.body.active === false || req.body.active === 'false')),
        'Saved.',
    ),
    // An order's keychain parcel: today's rates, buying its label, voiding it.
    orderRates: respond((req) => fulfillment.ratesForOrder(req.params.id)),
    buyLabel: respond((req) => fulfillment.buyOrderLabel(req.params.id, { rateId: req.body.rate_id }), 'Label bought.'),
    voidLabel: respond((req) => fulfillment.voidOrderLabel(req.params.id), 'Label voided.'),
};

module.exports = {
    claim, remove, plans, loadCheckout, quoteCheckout, payCheckout, getCheckout, mySubscription, cancelMine, resumeMine,
    shippoWebhook, admin,
};
