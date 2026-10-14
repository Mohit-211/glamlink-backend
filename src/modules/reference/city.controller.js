const catchAsync = require('../../core/http/catchAsync');
const cityService = require('./city.service');
const pick = require('../../core/utils/pick');
const config = require('../../core/config/config');
const responseWrapper = require('../../core/http/responseWrapper');


const getAllCity = catchAsync(async (req, res) => {

    const body = pick(req.body, []);
    const query = pick(req.query, ['sortBy', 'limit', 'page']);
    const params = pick(req.params, []);

    if (!query['limit']) {
        query['limit'] = config.defaultLimit
    }
    if (!query['page']) {
        query['page'] = 1
    }
    if (!query['sortBy'] || query['sortBy'] === '') {
        query['sortBy'] = 'ASC'
    }
    let offset = (query['page'] - 1) * query['limit'];
    query['offset'] = offset;

    const response = await cityService.getAllCity(body, query, params);
    return responseWrapper(res, response, '');
});

const getCityById = catchAsync(async (req, res) => {

    const body = pick(req.body, []);
    const query = pick(req.query, ['sortBy', 'limit', 'page']);
    const params = pick(req.params, ['id']);

    const response = await cityService.getCityById(body, query, params);
    return responseWrapper(res, response, '');
});

module.exports = {
    getAllCity,
    getCityById
};