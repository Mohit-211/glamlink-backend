/** @format */

const httpStatus = require("../../core/http/status");

const catchAsync = require("../../core/http/catchAsync");
const numeralService = require("./numeral.service");
const responseWrapper = require("../../core/http/responseWrapper");

const calculateCheckoutTax = catchAsync(async (req, res) => {
	const response = await numeralService.calculateCheckoutTax(req.body);
	return responseWrapper(res, response, "Product Created.", httpStatus.CREATED);
});

module.exports = {
	calculateCheckoutTax,
};
