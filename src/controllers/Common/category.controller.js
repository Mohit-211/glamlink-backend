const httpStatus = require('http-status');
const config = require('../../config/config');
const pick = require('../../utils/pick');
const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const { categoryService } = require('../../services/Common');
const responseWrapper = require('../../config/responseWrapper');


const createCategory = catchAsync(async (req, res) => {
    const body = pick(req.body, ['title']);
    const categoryDoc = await categoryService.createCategory(body);
    return responseWrapper(res, categoryDoc, 'New category Created Successfully', httpStatus.CREATED);
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
    const categorys = await categoryService.getAllCategories(query);
    return responseWrapper(res, categorys, '');
});

const updateCategory = catchAsync(async (req, res) => {
    const body = pick(req.body, ['title', 'description']);
    const categoryDoc = await categoryService.updateCategory(body, req.params.id);
    return responseWrapper(res, categoryDoc, 'Category Update Successfully');
});

const findCategoryById = catchAsync(async (req, res) => {

    const categoryDoc = await categoryService.findCategoryById(req.params.id);
    return responseWrapper(res, categoryDoc, '');
});

const deleteCategory = catchAsync(async (req, res) => {

    await categoryService.deleteCategory(req.body);
    return responseWrapper(res, '', 'Delete Successfull.', httpStatus.OK);
});

module.exports = {
    findCategoryById,
    createCategory,
    getAllCategories,
    updateCategory,
    deleteCategory
};