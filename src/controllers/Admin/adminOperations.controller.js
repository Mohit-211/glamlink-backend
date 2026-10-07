const catchAsync = require("../../utils/catchAsync");
const { adminOperationsService } = require("../../services");
const responseWrapper = require("../../config/responseWrapper");

const getLikesByPostId = catchAsync(async (req, res) => {
	const categoryDoc = await adminOperationsService.getLikesByPostId(req.body);
	return responseWrapper(res, categoryDoc, "");
});

const getCommentsByPostId = catchAsync(async (req, res) => {
	const categoryDoc = await adminOperationsService.getCommentsByPostId(req.body);
	return responseWrapper(res, categoryDoc, "");
});

const getLikessByReelId = catchAsync(async (req, res) => {
	const categoryDoc = await adminOperationsService.getLikessByReelId(req.body);
	return responseWrapper(res, categoryDoc, "");
});

const getCommentsByReelId = catchAsync(async (req, res) => {
	const categoryDoc = await adminOperationsService.getCommentsByReelId(req.body);
	return responseWrapper(res, categoryDoc, "");
});

const getFollowersByUserId = catchAsync(async (req, res) => {
	const categoryDoc = await adminOperationsService.getFollowersByUserId(req.body);
	return responseWrapper(res, categoryDoc, "");
});

const getFollowByUserId = catchAsync(async (req, res) => {
	const categoryDoc = await adminOperationsService.getFollowByUserId(req.body);
	return responseWrapper(res, categoryDoc, "");
});

const getPostByUserId = catchAsync(async (req, res) => {
	const categoryDoc = await adminOperationsService.getPostByUserId(req.body);
	return responseWrapper(res, categoryDoc, "");
});

const getPostLikeByUserId = catchAsync(async (req, res) => {
	const categoryDoc = await adminOperationsService.getPostLikeByUserId(req.body);
	return responseWrapper(res, categoryDoc, "");
});

const getPostCommentByUserId = catchAsync(async (req, res) => {
	const categoryDoc = await adminOperationsService.getPostCommentByUserId(req.body);
	return responseWrapper(res, categoryDoc, "");
});


const getClipsByUserId = catchAsync(async (req, res) => {
	const categoryDoc = await adminOperationsService.getClipsByUserId(req.body);
	return responseWrapper(res, categoryDoc, "");
});

const getClipsLikeByUserId = catchAsync(async (req, res) => {
	const categoryDoc = await adminOperationsService.getClipsLikeByUserId(req.body);
	return responseWrapper(res, categoryDoc, "");
});

const getClipsCommentByUserId = catchAsync(async (req, res) => {
	const categoryDoc = await adminOperationsService.getClipsCommentByUserId(req.body);
	return responseWrapper(res, categoryDoc, "");
});

const getReviewsGivenByUserId = catchAsync(async (req, res) => {
	const categoryDoc = await adminOperationsService.getReviewsGivenByUserId(req.body);
	return responseWrapper(res, categoryDoc, "");
});

const getReviewsTakenByUserId = catchAsync(async (req, res) => {
	const categoryDoc = await adminOperationsService.getReviewsTakenByUserId(req.body);
	return responseWrapper(res, categoryDoc, "");
});

const getServicesByUserId = catchAsync(async (req, res) => {
	const categoryDoc = await adminOperationsService.getServicesByUserId(req.body);
	return responseWrapper(res, categoryDoc, "");
});

const getBookingsByCounsellorId = catchAsync(async (req, res) => {
	const categoryDoc = await adminOperationsService.getBookingsByCounsellorId(req.body);
	return responseWrapper(res, categoryDoc, "");
});

const getBookingsByUserId = catchAsync(async (req, res) => {
	const categoryDoc = await adminOperationsService.getBookingsByUserId(req.body);
	return responseWrapper(res, categoryDoc, "");
});

const getAvailablityByUserId = catchAsync(async (req, res) => {
	const categoryDoc = await adminOperationsService.getAvailablityByUserId(req.body);
	return responseWrapper(res, categoryDoc, "");
});



module.exports = {
	getLikesByPostId,
	getCommentsByPostId,
	getLikessByReelId,
	getCommentsByReelId,
	getFollowersByUserId,
	getFollowByUserId,
	getPostByUserId,
	getPostLikeByUserId,
	getPostCommentByUserId,
	getClipsByUserId,
	getClipsLikeByUserId,
	getClipsCommentByUserId,
	getReviewsGivenByUserId,
	getReviewsTakenByUserId,
	getServicesByUserId,
	getBookingsByCounsellorId,
	getBookingsByUserId,
	getAvailablityByUserId
};
