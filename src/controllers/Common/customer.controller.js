/** @format */

const httpStatus = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const { customerService } = require("../../services");
const responseWrapper = require("../../config/responseWrapper");


const createCustomer = catchAsync(async (req, res) => {
	const result = await customerService.createCustomer(req.body);
	return responseWrapper(
		res,
		result,
		"Customer Created Successfully.",
		httpStatus.CREATED
	);
});

const getAllCustomer = catchAsync(async (req, res) => {
	const response = await customerService.getAllCustomer(req.body);
	return responseWrapper(res, response, "");
});

const getAllCustomerName = catchAsync(async (req, res) => {
	const response = await customerService.getAllCustomerName(req.params.id);
	return responseWrapper(res, response, "");
});

const getCustomerById = catchAsync(async (req, res) => {
    const categoryDoc = await customerService.getCustomerById(req.params.id);
    return responseWrapper(res, categoryDoc, '');
});

const updateCustomer = catchAsync(async (req, res) => {

    const contactUsDoc = await customerService.updateCustomer(req.params.id, req.body);
    return responseWrapper(res, contactUsDoc, 'Update Successfully.');
});

const deleteCustomer = catchAsync(async (req, res) => {
    const response = await customerService.deleteCustomer(req.body);
    return responseWrapper(res, response, '');
});

const importCustomers = catchAsync(async (req, res) => {

    const contactUsDoc = await customerService.importCustomers(req.body);
    return responseWrapper(res, contactUsDoc, 'Update Successfully.');
});


module.exports = {
	createCustomer,
	getAllCustomer,
	getCustomerById,
	updateCustomer,
	deleteCustomer,
	importCustomers,
	getAllCustomerName
};
