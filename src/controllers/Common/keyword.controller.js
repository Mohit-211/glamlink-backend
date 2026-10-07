const httpStatus = require('http-status');
const config = require('../../config/config');
const pick = require('../../utils/pick');
const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const { keywordService } = require('../../services/Common');
const responseWrapper = require('../../config/responseWrapper');


const createKeyword = catchAsync(async (req, res) => {
    const body = pick(req.body, ['title', 'description']);
    if(!body.title || !body.description) return responseWrapper(res, '', 'Please provide required fields : title, description', httpStatus.BAD_REQUEST);
    const keywordDoc = await keywordService.createKeyword(body);
    return responseWrapper(res, keywordDoc, 'New keyword Created Successfully', httpStatus.CREATED);
});

const getAllCategories = catchAsync(async (req, res) => {
    const query = pick(req.query, ['limit', 'sortBy', 'offset', 'page' ]);
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
    const keywords = await keywordService.getAllCategories(query);
    return responseWrapper(res, keywords, '');
});

const updateKeyword = catchAsync(async (req, res) => {
    const body = pick(req.body, ['title', 'description']);
    const keywordDoc = await keywordService.updateKeyword(body, req.params.id);
    return responseWrapper(res, keywordDoc, 'Keyword Update Successfully');
});

const findKeywordById = catchAsync(async (req, res) => {

    const keywordDoc = await keywordService.findKeywordById(req.params.id);
    return responseWrapper(res, keywordDoc, '');
});

const deleteKeyword = catchAsync(async (req, res) => {

    await keywordService.deleteKeyword(req.params.id);
    return responseWrapper(res, '', 'Delete Successfull.', httpStatus.OK);
});

module.exports = {
    findKeywordById,
    createKeyword,
    getAllCategories,
    updateKeyword,
    deleteKeyword
};