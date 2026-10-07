/** @format */

const httpStatus = require("http-status");

const catchAsync = require("../../utils/catchAsync");
const { numeralService } = require("../../services");
const pick = require("../../utils/pick");
const config = require("../../config/config");
const responseWrapper = require("../../config/responseWrapper");

const calculateCheckoutTax = catchAsync(async (req, res) => {
	const response = await numeralService.calculateCheckoutTax(req.body);
	return responseWrapper(res, response, "Product Created.", httpStatus.CREATED);
});

module.exports = {
	calculateCheckoutTax,
};
