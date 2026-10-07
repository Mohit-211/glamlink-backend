const httpStatus = require('http-status');
const config = require('../../config/config');
const pick = require('../../utils/pick');
const catchAsync = require('../../utils/catchAsync');
const { albumService } = require('../../services/Common');
const responseWrapper = require('../../config/responseWrapper');


const createAlbum = catchAsync(async (req, res) => {
    const body = pick(req.body, ['title', 'description', 'user']);
    if (!body.title) return responseWrapper(res, '', 'Please provide required fields : title', httpStatus.BAD_REQUEST);
    const albumDoc = await albumService.createAlbum(body, req.files);
    return responseWrapper(res, albumDoc, 'New album Created Successfully', httpStatus.CREATED);
});

const getAllAlbums = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const params = pick(req.params, ['id']);
    const query = pick(req.query, ['limit', 'sortBy', 'offset', 'page']);
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
    const albums = await albumService.getAllAlbums(query, body, params);
    return responseWrapper(res, albums, '');
});

const updateAlbum = catchAsync(async (req, res) => {
    const body = pick(req.body, ['title', 'user']);
    const albumDoc = await albumService.updateAlbum(body, req.params.id, req.files);
    return responseWrapper(res, albumDoc, 'Album Update Successfully');
});

const findAlbumById = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const albumDoc = await albumService.findAlbumById(req.params.id, body);
    return responseWrapper(res, albumDoc, '');
});

const deleteAlbum = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    await albumService.deleteAlbum(req.params.id, body);
    return responseWrapper(res, '', 'Delete Successfull.', httpStatus.OK);
});

const likeAndDislikeAlbum = catchAsync(async (req, res) => {
    const body = pick(req.body, ['album_id', 'user']);
    const response = await albumService.likeAndDislikeAlbum(body);
    return responseWrapper(res, '', response, httpStatus.OK);
});

const createCommenetInAlbum = catchAsync(async (req, res) => {
    const body = pick(req.body, ['album_id', 'comment', 'user']);
    const response = await albumService.createCommenetInAlbum(body);
    return responseWrapper(res, response, 'New comment added to album.', httpStatus.CREATED);
});

const getAllCommentByAlbumId = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const params = pick(req.params, ['album_id']);
    const response = await albumService.getAllCommentByAlbumId(body, params);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const getAllLikesByAlbumId = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const params = pick(req.params, ['album_id']);
    const response = await albumService.getAllLikesByAlbumId(body, params);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const likeAndDislikeAlbumAttachment = catchAsync(async (req, res) => {
    const body = pick(req.body, ['album_attachment_id', 'user']);
    const response = await albumService.likeAndDislikeAlbumAttachment(body);
    return responseWrapper(res, '', response, httpStatus.OK);
});

const createCommenetInAlbumAttachment = catchAsync(async (req, res) => {
    const body = pick(req.body, ['album_attachment_id', 'comment', 'user']);
    const response = await albumService.createCommenetInAlbumAttachment(body);
    return responseWrapper(res, response, 'New comment added to album attachment.', httpStatus.CREATED);
});

const getAllCommentByAlbumAttachmentId = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const params = pick(req.params, ['album_attachment_id']);
    const response = await albumService.getAllCommentByAlbumAttachmentId(body, params);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const findAlbumAttachmentById = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const params = pick(req.params, ['album_attachment_id']);
    const response = await albumService.findAlbumAttachmentById(body, params);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const getAllLikeByAlbumAttachmentId = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const params = pick(req.params, ['album_attachment_id']);
    const response = await albumService.getAllLikeByAlbumAttachmentId(body, params);
    return responseWrapper(res, response, '', httpStatus.OK);
});

module.exports = {
    findAlbumById,
    createAlbum,
    getAllAlbums,
    updateAlbum,
    deleteAlbum,

    likeAndDislikeAlbum,
    createCommenetInAlbum,
    getAllCommentByAlbumId,
    likeAndDislikeAlbumAttachment,
    createCommenetInAlbumAttachment,
    getAllCommentByAlbumAttachmentId,
    findAlbumAttachmentById,
    getAllLikesByAlbumId,
    getAllLikeByAlbumAttachmentId,
};