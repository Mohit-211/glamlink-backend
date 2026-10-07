/** @format */

const httpStatus = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const { numeralTaxCategoryService } = require("../../services");
const responseWrapper = require("../../config/responseWrapper");

const createTaxCategory = catchAsync(async (req, res) => {
	const response = await numeralTaxCategoryService.createTaxCategory(req.body);
	return responseWrapper(res, response, "Category Created.", httpStatus.CREATED);
});

const getTaxCategoryById = catchAsync(async (req, res) => {
	const response = await numeralTaxCategoryService.getTaxCategoryById(req.params.id);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const getTaxCategoryName = catchAsync(async (req, res) => {
	const productCategoryDoc = await numeralTaxCategoryService.getTaxCategoryName(req.body);
	return responseWrapper(res, productCategoryDoc, "");
});

const updateTaxCategory = catchAsync(async (req, res) => {
	const response = await numeralTaxCategoryService.updateTaxCategory(req.body,req.params.id);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const deleteTaxCategory = catchAsync(async (req, res) => {
    await numeralTaxCategoryService.deleteTaxCategory(req.body);
    res.status(httpStatus.OK).send({
      code: httpStatus.NO_CONTENT,
      message: "Deleted Successfull.",
      data: "",
    });
  });

module.exports = {
	createTaxCategory,
	getTaxCategoryById,
	getTaxCategoryName,
	updateTaxCategory,
	deleteTaxCategory,
};
