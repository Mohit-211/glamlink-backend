/** @format */

const httpStatus = require("http-status");

const catchAsync = require("../../utils/catchAsync");
const { productService } = require("../../services");
const pick = require("../../utils/pick");
const responseWrapper = require("../../config/responseWrapper");

const createProduct = catchAsync(async (req, res) => {
	const response = await productService.createProduct(req.body, req.files);
	return responseWrapper(res, response, "Product Created.", httpStatus.CREATED);
});

const getPendingProductCount = catchAsync(async (req, res) => {
	const response = await productService.getPendingProductCount();
	return responseWrapper(res, response, "", httpStatus.OK);
});

const getAllProducts = catchAsync(async (req, res) => {
	const response = await productService.getAllProducts(req.body);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const getAllProductsByBeuticianId = catchAsync(async (req, res) => {
	const response = await productService.getAllProductsByBeuticianId(req.params.id);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const findProductById = catchAsync(async (req, res) => {
	const params = pick(req.params, ["id"]);
	const response = await productService.findProductById(req.body, params);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const updateProduct = catchAsync(async (req, res) => {
	const response = await productService.updateProduct(
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

const deleteProduct = catchAsync(async (req, res) => {
	await productService.deleteProduct(req.body);
	return responseWrapper(res, "", "Product Deleted.", httpStatus.OK);
});

const getAllProductsForUser = catchAsync(async (req, res) => {
	const bookings = await productService.getAllProductsForUser(req.body,req.headers);
	return responseWrapper(res, bookings, "");
});

const getAllProductsForAdmin = catchAsync(async (req, res) => {
	const response = await productService.getAllProductsForAdmin(req.body);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const getProductById = catchAsync(async (req, res) => {
	const params = pick(req.params, ["id"]);
	const response = await productService.getProductById(params);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const updateProductStatus = catchAsync(async (req, res) => {
	const form = await productService.updateProductStatus(req.body,req.params.id);
	return responseWrapper(
		res,
		form,
		"Updated Successfully",
		httpStatus.CREATED
	);
});


// SERVICE LOCATIPN APIS

const provideServiceLocation = catchAsync(async (req, res) => {
	const response = await productService.provideServiceLocation(req.body);
	return responseWrapper(res, response, "Location provided.", httpStatus.CREATED);
});

const getAllServiceLocations = catchAsync(async (req, res) => {
	const response = await productService.getAllServiceLocations(req.body);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const checkServiceLocation = catchAsync(async (req, res) => {
	const response = await productService.checkServiceLocation(req.body);
	return responseWrapper(res, response, "", httpStatus.OK);
});


const deleteServiceLocations = catchAsync(async (req, res) => {
	await productService.deleteServiceLocations(req.body);
	return responseWrapper(res, "", "Service locations deleted successfully.", httpStatus.OK);
});

module.exports = {
	createProduct,
	getPendingProductCount,
	getAllProducts,
	findProductById,
	getProductById,
	updateProduct,
	deleteProduct,
	getAllProductsByBeuticianId,
	getAllProductsForUser,
	getAllProductsForAdmin,
	updateProductStatus,
	provideServiceLocation,
	getAllServiceLocations,
	checkServiceLocation,
	deleteServiceLocations
};
