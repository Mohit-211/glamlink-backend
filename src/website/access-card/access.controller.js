const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const catchAsync = require('../../core/http/catchAsync');
const responseWrapper = require('../../core/http/responseWrapper');
const { verifyCardToken, cardTokenFromRequest } = require('./cardToken');
const { claimCard, deleteOwnCard } = require('./cardOwnership');

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

module.exports = { claim, remove };
