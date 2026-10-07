/** @format */

const httpStatus = require("http-status");

const catchAsync = require("../../utils/catchAsync");
const { wishListService } = require("../../services");
const responseWrapper = require("../../config/responseWrapper");

const addToWishlist = catchAsync(async (req, res) => {
	const result = await wishListService.addToWishlist(req.body);
	return res.status(result.status).json({
		success: result.success,
		status: result.status,
		message: result.message,
	});
});

const getAllItemsFromWishlist = catchAsync(async (req, res) => {
	const test = await wishListService.getAllItemsFromWishlist(req.body);
	return responseWrapper(res, test, "");
});

const removeProductFromWishlist = catchAsync(async (req, res) => {
	await wishListService.removeProductFromWishlist(req.body);
	return responseWrapper(
	  res,
	  "",
	  "Product Removed Successfully.",
	  httpStatus.CREATED
	);
  });

module.exports = {
	addToWishlist,
    getAllItemsFromWishlist,
	removeProductFromWishlist
};
