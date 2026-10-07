const httpStatus = require('http-status');

const catchAsync = require('../../utils/catchAsync');
const { reviewService } = require('../../services');
const responseWrapper = require('../../config/responseWrapper');
const pick = require('../../utils/pick');

const createReview = catchAsync(async (req, res) => {
    const response = await reviewService.createReview(req.body);
    return responseWrapper(res, response, '', httpStatus.CREATED);
});

const updateReview = catchAsync(async (req, res) => {
    const body = pick(req.body, ['text', 'user', 'level', 'reviewDoc']);
    const params = pick(req.params, ['review_id']);
    const response = await reviewService.updateReview(body, params);
    return responseWrapper(res, response, '', httpStatus.OK);
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
    updateReview,
    deleteReview,
    raiseReviewRemoveRequest,
    getAllReviewByCounselorId,

    likeAndDislikeReview,
    createCommenetInReview,

    getAllReviews,

};