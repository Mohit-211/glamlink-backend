/** @format */

const httpStatus = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const { staffService } = require("../../services");
const responseWrapper = require("../../config/responseWrapper");


const createStaff = catchAsync(async (req, res) => {
	const result = await staffService.createStaff(req.body);
	return responseWrapper(
		res,
		result,
		"Staff Created Successfully.",
		httpStatus.CREATED
	);
});

const getAllStaff = catchAsync(async (req, res) => {
	const response = await staffService.getAllStaff(req.body);
	return responseWrapper(res, response, "");
});

const getStaffById = catchAsync(async (req, res) => {
    const categoryDoc = await staffService.getStaffById(req.params.id);
    return responseWrapper(res, categoryDoc, '');
});

const updateStaff = catchAsync(async (req, res) => {

    const contactUsDoc = await staffService.updateStaff(req.params.id, req.body);
    return responseWrapper(res, contactUsDoc, 'Update Successfully.');
});

const deleteStaff = catchAsync(async (req, res) => {
    const response = await staffService.deleteStaff(req.body);
    return responseWrapper(res, response, '');
});

const importStaff = catchAsync(async (req, res) => {

    const contactUsDoc = await staffService.importStaff(req.body);
    return responseWrapper(res, contactUsDoc, 'Update Successfully.');
});


module.exports = {
	createStaff,
	getAllStaff,
	getStaffById,
	updateStaff,
	deleteStaff,
	importStaff
};
