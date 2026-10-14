/** @format */

const httpStatus = require("../../core/http/status");

const catchAsync = require("../../core/http/catchAsync");
const productReviewService = require("./productReview.service");
const responseWrapper = require("../../core/http/responseWrapper");

const postReviewAndRating = catchAsync(async (req, res) => {
	const data = await productReviewService.postReviewAndRating(req.body);
	return responseWrapper(
		res,
		data,
		"Successfully posted review and ratings.",
		httpStatus.CREATED
	);
});

const updateReviewAndRating = catchAsync(async (req, res) => {
	const data = await productReviewService.updateReviewAndRating(req.body);
	return responseWrapper(
		res,
		data,
		"Successfully updated review and ratings.",
		httpStatus.CREATED
	);
});

const deleteReviewAndRating = catchAsync(async (req, res) => {
	await productReviewService.deleteReviewAndRating(req.params.id);
	return responseWrapper(res, "", "Deleted Successfull.");
});

const getReviewsAndRatings = catchAsync(async (req, res) => {
	const courses = await productReviewService.getReviewsAndRatings(req.body);
	return responseWrapper(res, courses, "");
});

const getAllReviewsAndRatings = catchAsync(async (req, res) => {
	const courses = await productReviewService.getAllReviewsAndRatings(req.body);
	return responseWrapper(res, courses, "");
});

const getReviewsAndRatingsByProductId = catchAsync(async (req, res) => {
	const courses = await productReviewService.getReviewsAndRatingsByProductId(req.body);
	return responseWrapper(res, courses, "");
});

module.exports = {
	postReviewAndRating,
	updateReviewAndRating,
	deleteReviewAndRating,
    getReviewsAndRatings,
    getAllReviewsAndRatings,
	getReviewsAndRatingsByProductId
};
