const httpStatus = require("../../core/http/status");

const catchAsync = require("../../core/http/catchAsync");
const cartService = require("./cart.service");
const responseWrapper = require("../../core/http/responseWrapper");

const addItemToCart = catchAsync(async (req, res) => {
  await cartService.addItemToCart(req.body);
  return responseWrapper(
    res,
    "",
    "Item added to cart Successfully.",
    httpStatus.CREATED
  );
});

const updateProductQuantity = catchAsync(async (req, res) => {
  await cartService.updateProductQuantity(req.body);
  return responseWrapper(
    res,
    "",
    "Cart Updated Successfully.",
    httpStatus.CREATED
  );
});

const removeProduct = catchAsync(async (req, res) => {
  await cartService.removeProduct(req.body);
  return responseWrapper(
    res,
    "",
    "Product Removed Successfully.",
    httpStatus.CREATED
  );
});


const getAllProductsInCart = catchAsync(async (req, res) => {
  const bookings = await cartService.getAllProductsInCart(req.body);
  return responseWrapper(res, bookings, "");
});




module.exports = {
  addItemToCart,
  removeProduct,
  updateProductQuantity,
  getAllProductsInCart,
  

};
