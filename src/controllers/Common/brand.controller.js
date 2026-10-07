/** @format */

const httpStatus = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const { brandService } = require("../../services");
const responseWrapper = require("../../config/responseWrapper");

const createBrand = catchAsync(async (req, res) => {
	const response = await brandService.createBrand(req.body);
	return responseWrapper(res, response, "Brand Created.", httpStatus.CREATED);
});

const getAllBrands = catchAsync(async (req, res) => {
	const response = await brandService.getAllBrands(req.body);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const getBrandById = catchAsync(async (req, res) => {
	const response = await brandService.getBrandById(req.params.id);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const getBrandName = catchAsync(async (req, res) => {
	const productCategoryDoc = await brandService.getBrandName(req.body);
	return responseWrapper(res, productCategoryDoc, "");
});

const updateBrand = catchAsync(async (req, res) => {
	const response = await brandService.updateBrand(req.body,req.params.id);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const deleteBrand = catchAsync(async (req, res) => {
    await brandService.deleteBrand(req.body);
    res.status(httpStatus.OK).send({
      code: httpStatus.NO_CONTENT,
      message: "Deleted Successfull.",
      data: "",
    });
  });

module.exports = {
	createBrand,
	getAllBrands,
	getBrandById,
	getBrandName,
	updateBrand,
	deleteBrand,
};
