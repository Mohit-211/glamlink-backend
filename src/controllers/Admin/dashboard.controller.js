/** @format */

const httpStatus = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const { dashboardService } = require("../../services");

const getUserCount = catchAsync(async (req, res) => {
	const user = await dashboardService.getUserCount();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getProfessionalsCount = catchAsync(async (req, res) => {
	const user = await dashboardService.getProfessionalsCount();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getPostsCount = catchAsync(async (req, res) => {
	const user = await dashboardService.getPostsCount();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getClipsCount = catchAsync(async (req, res) => {
	const user = await dashboardService.getClipsCount();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getAverageLikesPerPostCount = catchAsync(async (req, res) => {
	const user = await dashboardService.getAverageLikesPerPostCount();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getAverageLikesPerClipCount = catchAsync(async (req, res) => {
	const user = await dashboardService.getAverageLikesPerClipCount();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getAverageCommentPerPostCount = catchAsync(async (req, res) => {
	const user = await dashboardService.getAverageCommentPerPostCount();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getAverageCommentPerClipCount = catchAsync(async (req, res) => {
	const user = await dashboardService.getAverageCommentPerClipCount();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getAverageFollowersPerUser = catchAsync(async (req, res) => {
	const user = await dashboardService.getAverageFollowersPerUser();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getAverageFollowingPerUser = catchAsync(async (req, res) => {
	const user = await dashboardService.getAverageFollowingPerUser();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getAverageFollowersPerProfessional = catchAsync(async (req, res) => {
	const user = await dashboardService.getAverageFollowersPerProfessional();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getAverageFollowingPerProfessional = catchAsync(async (req, res) => {
	const user = await dashboardService.getAverageFollowingPerProfessional();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getAveragePostByUser = catchAsync(async (req, res) => {
	const user = await dashboardService.getAveragePostByUser();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getAveragePostByProfessional = catchAsync(async (req, res) => {
	const user = await dashboardService.getAveragePostByProfessional();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getAverageServicesPerProfessional = catchAsync(async (req, res) => {
	const user = await dashboardService.getAverageServicesPerProfessional();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getMostPostedService = catchAsync(async (req, res) => {
	const user = await dashboardService.getMostPostedService();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getMostBookedService = catchAsync(async (req, res) => {
	const user = await dashboardService.getMostBookedService();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getMostBookedProfessional = catchAsync(async (req, res) => {
	const user = await dashboardService.getMostBookedProfessional();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getAverageBookingsPerProfessional = catchAsync(async (req, res) => {
	const user = await dashboardService.getAverageBookingsPerProfessional();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getMostBookedTimeSlots = catchAsync(async (req, res) => {
	const user = await dashboardService.getMostBookedTimeSlots();
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getNewUsersRegistered = catchAsync(async (req, res) => {
	const user = await dashboardService.getNewUsersRegistered(req.body);
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const getNewProfessionalsRegistered = catchAsync(async (req, res) => {
	const user = await dashboardService.getNewProfessionalsRegistered(req.body);
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const postUploadedStatistics = catchAsync(async (req, res) => {
	const user = await dashboardService.postUploadedStatistics(req.body);
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

const clipsUploadedStatistics = catchAsync(async (req, res) => {
	const user = await dashboardService.clipsUploadedStatistics(req.body);
	res.status(httpStatus.OK).send({
		code: httpStatus.OK,
		message: user ? "Success" : "Failed",
		data: user,
	});
});

module.exports = {
	getUserCount,
	getProfessionalsCount,
    getPostsCount,
    getClipsCount,
    getAverageLikesPerPostCount,
    getAverageLikesPerClipCount,
    getAverageCommentPerPostCount,
    getAverageCommentPerClipCount,
    getAverageFollowersPerUser,
    getAverageFollowingPerUser,
	getAverageFollowersPerProfessional,
	getAverageFollowingPerProfessional,
	getAveragePostByUser,
	getAveragePostByProfessional,
	getAverageServicesPerProfessional,
	getMostPostedService,
	getMostBookedService,
	getMostBookedProfessional,
	getAverageBookingsPerProfessional,
	getMostBookedTimeSlots,
	getNewUsersRegistered,
	getNewProfessionalsRegistered,
	postUploadedStatistics,
	clipsUploadedStatistics
};
