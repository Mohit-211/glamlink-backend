const httpStatus = require('http-status');
const catchAsync = require('../../utils/catchAsync');
const { reelService } = require('../../services/Common');
const responseWrapper = require('../../config/responseWrapper');
const pick = require('../../utils/pick');
const config = require('../../config/config');

const createReel = catchAsync(async (req, res) => {

    const reel = await reelService.createReel(req.body, req.files);
    return responseWrapper(res, reel || null, 'New Reel Created Successfully.', httpStatus.CREATED);
});

const getAllReel = catchAsync(async (req, res) => {
    const query = pick(req.query, ['limit', 'sortBy', 'offset', 'page']);
    const body = pick(req.body, ['user']);
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
    const reels = await reelService.getAllReel(body, query);
    return responseWrapper(res, reels, '', httpStatus.OK);
});

const getAllMyReel = catchAsync(async (req, res) => {
    const query = pick(req.query, ['limit', 'sortBy', 'offset', 'page']);
    const body = pick(req.body, ['user']);
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
    const reels = await reelService.getAllMyReel(body, query);
    return responseWrapper(res, reels, '', httpStatus.OK);
});

const updateReel = catchAsync(async (req, res) => {

    const reel = await reelService.updateReel(req.body, req.params.id, req.files);
    return responseWrapper(res, reel, 'Updated Successfully', httpStatus.OK);
});

const getReelDetails = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const param = pick(req.params, ['id']);
    const result = await reelService.getReelDetails(body, param);
    return responseWrapper(res, result, 'Success', httpStatus.OK);
});

const deleteReel = catchAsync(async (req, res) => {
    await reelService.deleteReel(req.body, req.params.id);
    return responseWrapper(res, '', 'Deleted Successfully', httpStatus.OK);
});

const likeAndDislikeReel = catchAsync(async (req, res) => {

    const body = pick(req.body, ['reel_id', 'user']);
    const response = await reelService.likeAndDislikeReel(body, req.io);
    return responseWrapper(res, '', response, httpStatus.CREATED);
});

const createCommenetInReel = catchAsync(async (req, res) => {

    const body = pick(req.body, ['reel_id', 'comment', 'user']);
    const response = await reelService.createCommenetInReel(body);
    return responseWrapper(res, response, '', httpStatus.CREATED);
});

const getAllCommentByReelId = catchAsync(async (req, res) => {

    const body = pick(req.body, ['user']);
    const params = pick(req.params, ['reel_id']);
    const response = await reelService.getAllCommentByReelId(body, params);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const deleteCommentFromReel = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const param = pick(req.params, ['comment_id']);
    const message = await reelService.deleteCommentFromReel(body, param);
    return responseWrapper(res, '', message, httpStatus.OK);
});

module.exports = {
    createReel,
    getAllReel,
    updateReel,
    deleteReel,
    likeAndDislikeReel,
    createCommenetInReel,
    getAllCommentByReelId,
    getReelDetails,
    getAllMyReel,
    deleteCommentFromReel,
    deleteReel,
};