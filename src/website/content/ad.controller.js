const httpStatus = require("../../core/http/status");
const catchAsync = require("../../core/http/catchAsync");
const adService = require("./ad.service");
const adStatsService = require("./adStats.service");
const { isYes } = require("../../core/utils/formValues");
const responseWrapper = require("../../core/http/responseWrapper");

const createAd = catchAsync(async (req, res) => {
	const adDoc = await adService.createAd(req.body, req.files);
	return responseWrapper(
		res,
		adDoc,
		"New Ad Created Successfully",
		httpStatus.CREATED,
	);
});

// ?live=true: the ads to show now (active, inside their dates), by slot and page; without: every ad (the admin list).
const getAllAds = catchAsync(async (req, res) => {
	const ads = isYes(req.query.live) ? await adStatsService.liveAds(req.query) : await adService.getAllAds();
	return responseWrapper(res, ads, "");
});

const trackAd = catchAsync(async (req, res) => {
	const data = await adStatsService.track(req.body);
	return responseWrapper(res, data, "");
});

const adTotals = catchAsync(async (req, res) => {
	const data = await adStatsService.totals(req.query);
	return responseWrapper(res, data, "");
});

const adDaily = catchAsync(async (req, res) => {
	const data = await adStatsService.daily(req.params.id, req.query);
	return responseWrapper(res, data, "");
});

const findAdById = catchAsync(async (req, res) => {
	const adDoc = await adService.findAdById(req.params.id);
	return responseWrapper(res, adDoc, "");
});

const updateAd = catchAsync(async (req, res) => {
	const adDoc = await adService.updateAd(
		req.body,
		req.params.id,
		req.files
	);
	return responseWrapper(res, adDoc, "Ad Updated Successfully");
});

const deleteAd = catchAsync(async (req, res) => {
	await adService.deleteAd(req.body);
	return responseWrapper(res, "", "Delete Successfull.", httpStatus.OK);
});

const updateAdStatus = catchAsync(async (req, res) => {
	const adDoc = await adService.updateAdStatus(
		req.params.id,
		req.body.status
	);
	return responseWrapper(res, adDoc, "Ad Status Updated Successfully");
});

const updateAdSortOrder = catchAsync(async (req, res) => {
  await adService.updateAdSortOrder(req.body);

  return responseWrapper(
    res,
    "",
    "Ad order updated successfully.",
    httpStatus.OK,
  );
});

module.exports = {
	trackAd,
	adTotals,
	adDaily,
	createAd,
	getAllAds,
	findAdById,
	updateAd,
	deleteAd,
	updateAdStatus,
	updateAdSortOrder
};