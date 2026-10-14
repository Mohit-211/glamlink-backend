const httpStatus = require('http-status');

const catchAsync = require('../../core/http/catchAsync');
const priceService = require('./price.service');
const responseWrapper = require('../../core/http/responseWrapper');
const pick = require('../../core/utils/pick');

const createPrice = catchAsync(async (req, res) => {
    const response = await priceService.createPrice(req.body);
    return responseWrapper(res, response, '', httpStatus.CREATED);
});

const updatePrice = catchAsync(async (req, res) => {
    const body = pick(req.body, ['duration', 'user', 'price']);
    const params = pick(req.params, ['priceId']);
    const response = await priceService.updatePrice(body, params);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const getAllPrice = catchAsync(async (req, res) => {
    const response = await priceService.getAllPrice();
    return responseWrapper(res, response, '', httpStatus.OK);
});


module.exports = {
    createPrice,
    updatePrice,
    getAllPrice
};