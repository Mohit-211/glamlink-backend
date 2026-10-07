const httpStatus = require('http-status');

const catchAsync = require('../../utils/catchAsync');
const { priceService } = require('../../services');
const responseWrapper = require('../../config/responseWrapper');
const pick = require('../../utils/pick');

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

const deletePrice = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const params = pick(req.params, ['priceId']);
    const response = await priceService.deletePrice(body, params);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const getAllPrice = catchAsync(async (req, res) => {
    const response = await priceService.getAllPrice();
    return responseWrapper(res, response, '', httpStatus.OK);
});


module.exports = {
    createPrice,
    updatePrice,
    deletePrice,
    getAllPrice
};