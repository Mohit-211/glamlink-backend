const catchAsync = require('../../core/http/catchAsync');
const promotionRequestService = require('./promotionRequest.service');
const responseWrapper = require('../../core/http/responseWrapper');

const requestForPromotion = catchAsync(async (req, res) => {
    let response = await promotionRequestService.requestForPromotion(req.body);
    return responseWrapper(res, response, '');
});

module.exports = {
    requestForPromotion,
};
