const jwt = require('jsonwebtoken');
const httpStatus = require('../../core/http/status');
const catchAsync = require('../../core/http/catchAsync');
const ApiError = require('../../core/http/ApiError');
const { BusinessCard } = require('../../models');
const { identify, tokenFromRequest } = require('../../shared/identity');
const { identifyAdmin } = require('../../shared/admin');
const { cardTokenFromRequest, verifyCardToken } = require('./cardToken');

const cardTokenRequired = () =>
    ApiError.withCode(httpStatus.UNAUTHORIZED, 'This card can only be changed by its owner or from the purchase that created it.', 'CARD_TOKEN_REQUIRED');

// Who may act on a card in the purchase flow: the buyer holding its card token (cardToken.js), its signed-in
// owner, or an admin. getCardId(req) returns the card the request acts on.
// unownedOnly: for editing the card itself. The card token counts only while nobody owns the card; an owned card
// is changed by its owner or an admin, as before.
// A missing id or an unknown card goes on to the handler, which answers as it always has.
const requireCardAccess = (getCardId, { unownedOnly = false } = {}) => catchAsync(async (req, res, next) => {
    const id = getCardId(req);
    if (id === undefined || id === null || String(id).trim() === '') return next();
    const card = await BusinessCard.findOne({ where: { id: String(id).trim() }, attributes: ['id', 'user_id'] });
    if (!card) return next();
    const owned = card.user_id !== null && card.user_id !== undefined;

    if (!(unownedOnly && owned) && verifyCardToken(cardTokenFromRequest(req), card.id)) return next();
    if (await identifyAdmin(req)) return next();
    if (owned && tokenFromRequest(req)) {
        await identify(req);
        if (req.user && String(card.user_id) === String(req.user.id)) return next();
        if (req.user) throw new ApiError(httpStatus.FORBIDDEN, 'You can only change your own records');
    }
    if (unownedOnly && owned) throw ApiError.withCode(httpStatus.UNAUTHORIZED, 'Please sign in.', 'SIGN_IN_REQUIRED');
    throw cardTokenRequired();
});

// Whether a request already identified (req.user, req.isAdmin) may act on a card, by requireCardAccess's rule: its
// card token, an admin, or its owner. For the checkout routes, which must not tell anyone else what exists (BE-38).
const mayActOnCard = async (req, cardId) => {
    const card = await BusinessCard.findOne({ where: { id: cardId }, attributes: ['id', 'user_id'] });
    if (!card) return false;
    if (req.isAdmin || verifyCardToken(cardTokenFromRequest(req), card.id)) return true;
    return Boolean(req.user && card.user_id && String(card.user_id) === String(req.user.id));
};

// Whether a request proves anything about its sender: a sign-in, or a card token that is valid (for any card).
const sentProof = (req) => {
    if (tokenFromRequest(req)) return true;
    const token = cardTokenFromRequest(req);
    return Boolean(token && verifyCardToken(token, jwt.decode(token)?.sub));
};

module.exports = { requireCardAccess, mayActOnCard, sentProof, cardTokenRequired };
