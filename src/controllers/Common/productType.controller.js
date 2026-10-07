/** @format */

const httpStatus = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const { productTypeService } = require("../../services");
const responseWrapper = require("../../config/responseWrapper");

const createProductType = catchAsync(async (req, res) => {
	const response = await productTypeService.createProductType(req.body);
	return responseWrapper(res, response, "Type Created.", httpStatus.CREATED);
});

const getAllProductType = catchAsync(async (req, res) => {
	const response = await productTypeService.getAllProductType(req.body);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const getProductTypeById = catchAsync(async (req, res) => {
	const response = await productTypeService.getProductTypeById(req.params.id);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const getProductTypeName = catchAsync(async (req, res) => {
	const productCategoryDoc = await productTypeService.getProductTypeName(req.body);
	return responseWrapper(res, productCategoryDoc, "");
});

const updateProductType = catchAsync(async (req, res) => {
	const response = await productTypeService.updateProductType(req.body,req.params.id);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const deleteProductType = catchAsync(async (req, res) => {
    await productTypeService.deleteProductType(req.body);
    res.status(httpStatus.OK).send({
      code: httpStatus.NO_CONTENT,
      message: "Deleted Successfull.",
      data: "",
    });
  });

module.exports = {
	createProductType,
	getAllProductType,
	getProductTypeById,
	getProductTypeName,
	updateProductType,
	deleteProductType,
};
