const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const { identify } = require('../../shared/identity');
const { BusinessCard } = require('../../models');
const { verifyCardToken, cardTokenFromRequest } = require('./cardToken');
const { claimCard, deleteOwnCard } = require('./cardOwnership');
const catalog = require('./catalog');

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

// ---- Admin: plans, prices, discounts, personal prices, settings ------------------------------------------

const adminId = (req) => req.user?.id || null;
const respond = (fn, message = '') => catchAsync(async (req, res) => responseWrapper(res, await fn(req), message));

const admin = {
    catalog: respond(() => catalog.adminCatalog()),
    updatePlan: respond((req) => catalog.updatePlan(req.params.code, req.body), 'Plan updated.'),
    changePrice: respond((req) => catalog.changePrice(req.params.code, req.body, adminId(req)), 'Price changed.'),
    priceChanges: respond(() => catalog.priceChanges()),
    discounts: respond(() => catalog.listDiscounts()),
    createDiscount: respond((req) => catalog.createDiscount(req.body, adminId(req)), 'Discount created.'),
    updateDiscount: respond((req) => catalog.updateDiscount(req.params.id, req.body), 'Discount updated.'),
    endDiscount: respond((req) => catalog.endDiscount(req.params.id), 'Discount ended.'),
    overrides: respond((req) => catalog.listOverrides(req.query)),
    createOverride: respond((req) => catalog.createOverride(req.body, adminId(req)), 'Personal price set.'),
    endOverride: respond((req) => catalog.endOverride(req.params.id), 'Personal price ended.'),
    updateSettings: respond((req) => catalog.updateSettings(req.body, adminId(req)), 'Settings saved.'),
};

module.exports = { claim, remove, plans, admin };
