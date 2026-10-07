const httpStatus = require('http-status');
const pick = require('../../utils/pick');
const catchAsync = require('../../utils/catchAsync');
const { journalCategoryService } = require('../../services/Common');
const responseWrapper = require('../../config/responseWrapper');


const createCategory = catchAsync(async (req, res) => {
    const body = pick(req.body, ['title']);
    const categoryDoc = await journalCategoryService.createCategory(body);
    return responseWrapper(res, categoryDoc, 'New category Created Successfully', httpStatus.CREATED);
});

const getAllCategories = catchAsync(async (req, res) => {
   
    const categorys = await journalCategoryService.getAllCategories();
    return responseWrapper(res, categorys, '');
});

const updateCategory = catchAsync(async (req, res) => {
    const body = pick(req.body, ['title', 'description']);
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