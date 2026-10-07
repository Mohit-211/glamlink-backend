const httpStatus = require('http-status');

const catchAsync = require('../../utils/catchAsync');
const { postService } = require('../../services');
const pick = require('../../utils/pick');
const config = require('../../config/config');
const responseWrapper = require('../../config/responseWrapper');

const createPost = catchAsync(async (req, res) => {

    const body = pick(req.body, ['content', 'type', 'user']);
    const response = await postService.createPost(body, req.files);
    return responseWrapper(res, response, '', httpStatus.CREATED);
});

const getAllPostByUserId = catchAsync(async (req, res) => {

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

    const response = await postService.getAllPostByUserId(body, query, params, headers);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const deletePostById = catchAsync(async (req, res) => {

    const body = pick(req.body, ['user', 'postDoc']);
    const params = pick(req.params, ['id']);

    const response = await postService.deletePostById(body, params);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const editPost = catchAsync(async (req, res) => {

    const body = pick(req.body, ['user', 'content', 'postDoc', 'deleted_image_ids']);
    const params = pick(req.params, ['id']);

    const response = await postService.editPost(body, params, req.files);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const getAllOtherUserPostByUserId = catchAsync(async (req, res) => {

    const body = pick(req.body, ['user']);
    const query = pick(req.query, ['sortBy', 'limit', 'page']);
    const params = pick(req.params, ['user_id']);
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

    const response = await postService.getAllOtherUserPostByUserId(body, query, params, headers);
    return responseWrapper(res, response, '', httpStatus.OK);
});


const postDetailsById = catchAsync(async (req, res) => {

    const params = pick(req.params, ['id']);
    const body = pick(req.body, ['user']);
    const header = pick(req.headers, ['timezone']);
    const response = await postService.postDetailsById(params, header, body);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const likeAndDislikePost = catchAsync(async (req, res) => {

    const body = pick(req.body, ['post_id', 'user']);
    const response = await postService.likeAndDislikePost(body, req.io);
    return responseWrapper(res, '', response, httpStatus.CREATED);
});

const createCommenetInPost = catchAsync(async (req, res) => {

    const body = pick(req.body, ['post_id', 'comment', 'user']);
    const response = await postService.createCommenetInPost(body);
    return responseWrapper(res, response, '', httpStatus.CREATED);
});

const deleteCommentFromPost = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const param = pick(req.params, ['comment_id']);
    const message = await postService.deleteCommentFromPost(body, param);
    return responseWrapper(res, '', message, httpStatus.OK);
});

const getAllCommentsByPostId = catchAsync(async (req, res) => {

    const body = pick(req.body, ['user']);
    const query = pick(req.query, ['sortBy', 'limit', 'page']);
    const params = pick(req.params, ['post_id']);

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

    const response = await postService.getAllCommentsByPostId(body, query, params);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const getAllUserLikedPostByPostId = catchAsync(async (req, res) => {

    const body = pick(req.body, ['user']);
    const query = pick(req.query, ['sortBy', 'limit', 'page']);
    const params = pick(req.params, ['post_id']);

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

    const response = await postService.getAllUserLikedPostByPostId(body, query, params);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const savePost = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'post_id']);
    const response = await postService.savePost(body);
    return responseWrapper(res, '', response, httpStatus.OK);
});

const getAllSavedPost = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const header = pick(req.headers, ['timezone']);
    const response = await postService.getAllSavedPost(body, header);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const reportPost = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'post_id', 'reason']);
    const response = await postService.reportPost(body);
    return responseWrapper(res, '', response, httpStatus.OK);
});

module.exports = {
    createPost,
    getAllPostByUserId,
    postDetailsById,
    likeAndDislikePost,
    createCommenetInPost,
    getAllOtherUserPostByUserId,
    getAllCommentsByPostId,
    getAllUserLikedPostByPostId,
    deletePostById,
    editPost,
    savePost,
    getAllSavedPost,
    reportPost,
    deleteCommentFromPost
};