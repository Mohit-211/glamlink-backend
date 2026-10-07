/** @format */

const httpStatus = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const { vendorService } = require("../../services");
const responseWrapper = require("../../config/responseWrapper");

const createVendor = catchAsync(async (req, res) => {
	const response = await vendorService.createVendor(req.body);
	return responseWrapper(res, response, "Vendor Created.", httpStatus.CREATED);
});

const getAllVendor = catchAsync(async (req, res) => {
	const response = await vendorService.getAllVendor(req.body);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const getVendorById = catchAsync(async (req, res) => {
	const response = await vendorService.getVendorById(req.params.id);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const getVendorName = catchAsync(async (req, res) => {
	const productCategoryDoc = await vendorService.getVendorName(req.body);
	return responseWrapper(res, productCategoryDoc, "");
});

const updateVendor = catchAsync(async (req, res) => {
	const response = await vendorService.updateVendor(req.body,req.params.id);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const deleteVendor = catchAsync(async (req, res) => {
    await vendorService.deleteVendor(req.body);
    res.status(httpStatus.OK).send({
      code: httpStatus.NO_CONTENT,
      message: "Deleted Successfull.",
      data: "",
    });
  });

module.exports = {
	createVendor,
	getAllVendor,
	getVendorById,
	getVendorName,
	updateVendor,
	deleteVendor,
};
