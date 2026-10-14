const httpStatus = require('../../core/http/status');

const catchAsync = require('../../core/http/catchAsync');
const storyService = require('./story.service');
const pick = require('../../core/utils/pick');
const config = require('../../core/config/config');
const responseWrapper = require('../../core/http/responseWrapper');

const createStory = catchAsync(async (req, res) => {

    const body = pick(req.body, ['content', 'type', 'user']);
    const response = await storyService.createStory(body, req.files);
    return responseWrapper(res, response, '', httpStatus.CREATED);
});

const getAllStoryByUserId = catchAsync(async (req, res) => {

    const body = pick(req.body, ['user']);
    const query = pick(req.query, ['sortBy', 'limit', 'page']);
    const params = pick(req.params, []);
    const headers = pick(req.headers, ['timezone']);

    if (!query['limit']) {
        query['limit'] = config.defaultLimit
    };
    if (!query['page']) {
        query['page'] = 1
    };
    if (!query['sortBy'] || query['sortBy'] === '') {
        query['sortBy'] = 'ASC'
    };
    let offset = (query['page'] - 1) * query['limit'];
    query['offset'] = offset;
    if (!headers['timezone'] || headers['timezone'] === '') {
        headers['timezone'] = config.DEFAULT_TIMEZONE;
    };

    const response = await storyService.getAllStoryByUserId(body, query, params, headers);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const storyDetailsById = catchAsync(async (req, res) => {

    const params = pick(req.params, ['id']);
    const response = await storyService.storyDetailsById(params);
    return responseWrapper(res, response, '', httpStatus.OK);
});




module.exports = {
    createStory,
    getAllStoryByUserId,
    storyDetailsById,
};