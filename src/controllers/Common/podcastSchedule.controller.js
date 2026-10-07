const httpStatus = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const responseWrapper = require("../../config/responseWrapper");
const { podcastScheduleService } = require("../../services/Common");

const createPodcastSchedule = catchAsync(async (req, res) => {
	const data = await podcastScheduleService.createPodcastSchedule(req.body);

	return responseWrapper(
		res,
		data,
		"Podcast schedule created successfully",
		httpStatus.CREATED
	);
});

const getPodcastSchedules = catchAsync(async (req, res) => {
	const data = await podcastScheduleService.getPodcastSchedules();

	return responseWrapper(
		res,
		data,
		"Podcast schedules fetched successfully",
		httpStatus.OK
	);
});

const getPodcastScheduleById = catchAsync(async (req, res) => {
	const data = await podcastScheduleService.getPodcastScheduleById(
		req.params.id,
	);

	return responseWrapper(
		res,
		data,
		"Podcast schedule fetched successfully",
		httpStatus.OK,
	);
});

const updatePodcastSchedule = catchAsync(async (req, res) => {
	const data = await podcastScheduleService.updatePodcastSchedule(
		req.params.id,
		req.body,
	);

	return responseWrapper(
		res,
		data,
		"Podcast schedule updated successfully",
		httpStatus.OK,
	);
});

const deletePodcastSchedule = catchAsync(async (req, res) => {
	const data = await podcastScheduleService.deletePodcastSchedule(
		req.body.ids,
	);

	return responseWrapper(
		res,
		data,
		"Podcast schedule deleted successfully",
		httpStatus.OK,
	);
});

module.exports = {
	createPodcastSchedule,
	getPodcastSchedules,
	getPodcastScheduleById,
	updatePodcastSchedule,
	deletePodcastSchedule
};