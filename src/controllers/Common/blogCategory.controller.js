const httpStatus = require('http-status');
const config = require('../../config/config');
const pick = require('../../utils/pick');
const catchAsync = require('../../utils/catchAsync');
const { blogCategoryService } = require('../../services/Common');
const responseWrapper = require('../../config/responseWrapper');


const createBlogCategory = catchAsync(async (req, res) => {
    const body = pick(req.body, ['title']);
    const blogCategoryDoc = await blogCategoryService.createBlogCategory(body);
    return responseWrapper(res, blogCategoryDoc, 'New blogCategory Created Successfully', httpStatus.CREATED);
});

const getAllBlogCategories = catchAsync(async (req, res) => {
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
    const blogCategorys = await blogCategoryService.getAllBlogCategories(query);
    return responseWrapper(res, blogCategorys, '');
});

const findBlogCategoryById = catchAsync(async (req, res) => {

    const blogCategoryDoc = await blogCategoryService.findBlogCategoryById(req.params.id);
    return responseWrapper(res, blogCategoryDoc, '');
});

const updateBlogCategory = catchAsync(async (req, res) => {
    const body = pick(req.body, ['title', 'description']);
    const blogCategoryDoc = await blogCategoryService.updateBlogCategory(body, req.params.id);
    return responseWrapper(res, blogCategoryDoc, 'BlogCategory Update Successfully');
});

const getBlogCategoryName = catchAsync(async (req, res) => {

    const blogCategoryDoc = await blogCategoryService.getBlogCategoryName();
    return responseWrapper(res, blogCategoryDoc, '');
});

const deleteBlogCategory = catchAsync(async (req, res) => {
    await blogCategoryService.deleteBlogCategory(req.body);
    res.status(httpStatus.OK).send({
      code: httpStatus.NO_CONTENT,
      message: "Deleted Successfull.",
      data: "",
    });
  });

module.exports = {
    findBlogCategoryById,
    createBlogCategory,
    getAllBlogCategories,
    getBlogCategoryName,
    updateBlogCategory,
    deleteBlogCategory
};