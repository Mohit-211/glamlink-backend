const httpStatus = require('../../core/http/status');
const pick = require('../../core/utils/pick');
const catchAsync = require('../../core/http/catchAsync');
const journalCategoryService = require('./journalCategory.service');
const responseWrapper = require('../../core/http/responseWrapper');


const createCategory = catchAsync(async (req, res) => {
    const body = pick(req.body, ['title', 'description', 'sort_order']);
    const categoryDoc = await journalCategoryService.createCategory(body);
    return responseWrapper(res, categoryDoc, 'New category Created Successfully', httpStatus.CREATED);
});

const getAllCategories = catchAsync(async (req, res) => {
   
    const categorys = await journalCategoryService.getAllCategories();
    return responseWrapper(res, categorys, '');
});

const updateCategory = catchAsync(async (req, res) => {
    const body = pick(req.body, ['title', 'description', 'sort_order']);
    const categoryDoc = await journalCategoryService.updateCategory(body, req.params.id);
    return responseWrapper(res, categoryDoc, 'Category Update Successfully');
});

const findCategoryById = catchAsync(async (req, res) => {

    const categoryDoc = await journalCategoryService.findCategoryById(req.params.id);
    return responseWrapper(res, categoryDoc, '');
});

const deleteCategory = catchAsync(async (req, res) => {

    await journalCategoryService.deleteCategory(req.body);
    return responseWrapper(res, '', 'Delete Successfull.', httpStatus.OK);
});

module.exports = {
    findCategoryById,
    createCategory,
    getAllCategories,
    updateCategory,
    deleteCategory
};