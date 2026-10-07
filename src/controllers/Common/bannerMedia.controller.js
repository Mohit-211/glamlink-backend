
const httpStatus = require("http-status");

const catchAsync = require("../../utils/catchAsync");
const { bannerService } = require("../../services");
const responseWrapper = require("../../config/responseWrapper");

const createBanner = catchAsync(async (req, res) => {
	const response = await bannerService.createBanner(req.body, req.files);
	return responseWrapper(res, response, "Product Created.", httpStatus.CREATED);
});

const getAllBanner = catchAsync(async (req, res) => {
	const response = await bannerService.getAllBanner();
	return responseWrapper(res, response, "", httpStatus.OK);
});

const findBannerById = catchAsync(async (req, res) => {
	const response = await bannerService.findBannerById(req.params.id);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const updateBanner = catchAsync(async (req, res) => {
	const response = await bannerService.updateBanner(
		req.body, 
		req.files,
		req.params.id
	);
	return responseWrapper(
		res,
		response,
		"Product Updated Successfully.",
		httpStatus.OK
	);
});

const deleteBanner = catchAsync(async (req, res) => {
	await bannerService.deleteBanner(req.body);
	return responseWrapper(res, "", "Product Deleted.", httpStatus.OK);
});

const getAllBannerByProfessional = catchAsync(async (req, res) => {
	const response = await bannerService.getAllBannerByProfessional(req.body);
	return responseWrapper(res, response, "", httpStatus.OK);
});


module.exports = {
	createBanner,
	getAllBanner,
	findBannerById,
	updateBanner,
	deleteBanner,
    getAllBannerByProfessional,
};
