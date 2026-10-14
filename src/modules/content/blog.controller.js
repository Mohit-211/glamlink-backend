const httpStatus = require('../../core/http/status');

const catchAsync = require('../../core/http/catchAsync');
const blogService = require('./blog.service');
const pick = require('../../core/utils/pick');
const config = require('../../core/config/config');
const responseWrapper = require('../../core/http/responseWrapper');

const createBlog = catchAsync(async (req, res) => {

    const body = pick(req.body, ['title', 'description', 'blog_category_ids', 'user']);
    const response = await blogService.createBlog(body, req.files);
    return responseWrapper(res, response, 'Blog Created.', httpStatus.CREATED);
});

const getAllBlogByToken = catchAsync(async (req, res) => {

    const body = pick(req.body, ['user']);
    const query = pick(req.query, ['sortBy', 'limit', 'page']);
    const params = pick(req.params, []);

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

    const response = await blogService.getAllBlogByToken( body, query, params );
    return responseWrapper(res, response, '', httpStatus.OK);
});


const blogDetailById = catchAsync(async (req, res) => {

    const body = pick(req.body, []);
    const params = pick(req.params, ['blog_id']);

    const response = await blogService.blogDetailById( body, params );
    return responseWrapper(res, response, '', httpStatus.OK);
});

const updateBlog = catchAsync(async (req, res) => {

    const body = pick(req.body, [ 'title', 'description', 'blog_category_ids', 'user']);
    const response = await blogService.updateBlog(body, req.files,req.params.id);
    return responseWrapper(res, response, 'Blog Updated Successfully.', httpStatus.OK);
});

const deleteBlog = catchAsync(async (req, res) => {
    await blogService.deleteBlog(req.body);
    return responseWrapper(res, '', 'Blog Deleted.', httpStatus.OK);
});


module.exports = {
    createBlog,
    getAllBlogByToken,
    blogDetailById,
    updateBlog,
    deleteBlog,
};