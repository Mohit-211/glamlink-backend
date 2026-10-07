/** @format */

const httpStatus = require("http-status");
const config = require("../../config/config");
const pick = require("../../utils/pick");
const catchAsync = require("../../utils/catchAsync");
const ApiError = require("../../utils/ApiError");
const { productCategoryService } = require("../../services/Common");
const responseWrapper = require("../../config/responseWrapper");

const createProductCategoryHeading = catchAsync(async (req, res) => {
	const body = pick(req.body, ["title"]);
	const productCategoryDoc = await productCategoryService.createProductCategoryHeading(
		body
	);
	return responseWrapper(
		res,
		productCategoryDoc,
		"New product category Created Successfully",
		httpStatus.CREATED
	);
});

const createProductCategory = catchAsync(async (req, res) => {
	const productCategoryDoc = await productCategoryService.createProductCategory(
		req.body
	);
	return responseWrapper(
		res,
		productCategoryDoc,
		"New product category Created Successfully",
		httpStatus.CREATED
	);
});

const getAllProductCategories = catchAsync(async (req, res) => {
	const query = pick(req.query, ["limit", "sortBy", "offset", "page"]);
	if (!query["limit"]) {
		query["limit"] = config.defaultLimit;
	}
	if (!query["page"]) {
		query["page"] = 1;
	}
	if (!query["sortBy"] || query["sortBy"] === "") {
		query["sortBy"] = "ASC";
	}
	let offset = (query["page"] - 1) * query["limit"];
	query["offset"] = offset;
	const productCategoryies = await productCategoryService.getAllProductCategories(
		query
	);
	return responseWrapper(res, productCategoryies, "");
});

const getProductCategory = catchAsync(async (req, res) => {
	const productCategoryDoc = await productCategoryService.getProductCategory();
	return responseWrapper(res, productCategoryDoc, "");
});

const getProductCategoryByCategoryId = catchAsync(async (req, res) => {
	const productCategoryDoc = await productCategoryService.getProductCategoryByCategoryId(req.body);
	return responseWrapper(res, productCategoryDoc, "");
});

const findProductCategoryById = catchAsync(async (req, res) => {
	const productCategoryDoc = await productCategoryService.findProductCategoryById(
		req.params.id
	);
	return responseWrapper(res, productCategoryDoc, "");
});

const getProductCategoryName = catchAsync(async (req, res) => {
	const productCategoryDoc = await productCategoryService.getProductCategoryName();
	return responseWrapper(res, productCategoryDoc, "");
});

const getAllProductCategoryName = catchAsync(async (req, res) => {
	const productCategoryDoc = await productCategoryService.getAllProductCategoryName();
	return responseWrapper(res, productCategoryDoc, "");
});

const updateProductCategoryHeading = catchAsync(async (req, res) => {
	const body = pick(req.body, ["title", "description"]);
	const productCategoryDoc = await productCategoryService.updateProductCategoryHeading(
		body,
		req.params.id
	);
	return responseWrapper(
		res,
		productCategoryDoc,
		"Product Category Update Successfully"
	);
});

const updateProductCategory = catchAsync(async (req, res) => {
	const body = pick(req.body, ["title", "description"]);
	const productCategoryDoc = await productCategoryService.updateProductCategory(
		body,
		req.params.id
	);
	return responseWrapper(
		res,
		productCategoryDoc,
		"Product Category Update Successfully"
	);
});

const deleteProductCategoryHeading = catchAsync(async (req, res) => {
	await productCategoryService.deleteProductCategoryHeading(req.body);
	res.status(httpStatus.OK).send({
		code: httpStatus.NO_CONTENT,
		message: "Deleted Successfull.",
		data: "",
	});
});

const deleteProductCategory = catchAsync(async (req, res) => {
	await productCategoryService.deleteProductCategory(req.body);
	res.status(httpStatus.OK).send({
		code: httpStatus.NO_CONTENT,
		message: "Deleted Successfull.",
		data: "",
	});
});

module.exports = {
	createProductCategoryHeading,
	createProductCategory,
	getAllProductCategories,
	getProductCategoryByCategoryId,
	getProductCategory,
	getAllProductCategoryName,
    findProductCategoryById,
	getProductCategoryName,
	updateProductCategoryHeading,
	updateProductCategory,
	deleteProductCategoryHeading,
	deleteProductCategory,
};
