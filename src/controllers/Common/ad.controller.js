/** @format */

const httpStatus = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const { adService } = require("../../services/Common");
const responseWrapper = require("../../config/responseWrapper");

const createAd = catchAsync(async (req, res) => {
	const adDoc = await adService.createAd(req.body, req.files);
	return responseWrapper(
		res,
		adDoc,
		"New Ad Created Successfully",
		httpStatus.CREATED,
	);
});

const getAllAds = catchAsync(async (req, res) => {
	const ads = await adService.getAllAds();
	return responseWrapper(res, ads, "");
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
	createAd,
	getAllAds,
	findAdById,
	updateAd,
	deleteAd,
	updateAdStatus,
	updateAdSortOrder
};