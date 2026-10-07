/** @format */

const httpStatus = require("http-status");

const catchAsync = require("../../utils/catchAsync");
const { numeralService } = require("../../services");
const responseWrapper = require("../../config/responseWrapper");

const calculateCheckoutTax = catchAsync(async (req, res) => {
	const response = await numeralService.calculateCheckoutTax(req.body);
	return responseWrapper(res, response, "Product Created.", httpStatus.CREATED);
});

module.exports = {
	calculateCheckoutTax,
};
