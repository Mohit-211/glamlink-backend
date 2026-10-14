const httpStatus = require('../../core/http/status');

const catchAsync = require('../../core/http/catchAsync');
const reviewService = require('./review.service');
const responseWrapper = require('../../core/http/responseWrapper');
const pick = require('../../core/utils/pick');

const createReview = catchAsync(async (req, res) => {
    const response = await reviewService.createReview(req.body);
    return responseWrapper(res, response, '', httpStatus.CREATED);
});


const deleteReview = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const params = pick(req.params, ['review_id']);
    const response = await reviewService.deleteReview(body, params);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const raiseReviewRemoveRequest = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'review_id']);
    const response = await reviewService.raiseReviewRemoveRequest(body);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const getAllReviewByCounselorId = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const params = pick(req.params, ['counselor_id']);
    const response = await reviewService.getAllReviewByCounselorId(body, params);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const likeAndDislikeReview = catchAsync(async (req, res) => {
    const body = pick(req.body, ['review_id', 'user']);
    const response = await reviewService.likeAndDislikeReview(body);
    return responseWrapper(res, '', response, httpStatus.OK);
});

const createCommenetInReview = catchAsync(async (req, res) => {
    const body = pick(req.body, ['review_id', 'comment', 'user']);
    const response = await reviewService.createCommenetInReview(body);
    return responseWrapper(res, response, 'New comment added to album attachment.', httpStatus.CREATED);
});

const getAllReviews = catchAsync(async (req, res) => {
    const response = await reviewService.getAllReviews(req.body);
    return responseWrapper(res, response, '', httpStatus.OK);
});




module.exports = {
    createReview,
    deleteReview,
    raiseReviewRemoveRequest,
    getAllReviewByCounselorId,

    likeAndDislikeReview,
    createCommenetInReview,

    getAllReviews,

};