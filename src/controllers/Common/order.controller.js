/** @format */

const httpStatus = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const { orderService } = require("../../services/Common");
const responseWrapper = require("../../config/responseWrapper");

const createOrder = catchAsync(async (req, res) => {
  let result = await orderService.createOrder(req.body);
  return responseWrapper(
    res,
    result,
    "New Order Placed Successfully.",
    httpStatus.CREATED,
  );
});

const getAllUserOrders = catchAsync(async (req, res) => {
  const bookings = await orderService.getAllUserOrders(req.body);
  return responseWrapper(res, bookings, "");
});

const addNewAddress = catchAsync(async (req, res) => {
  await orderService.addNewAddress(req.body, req.headers);
  return responseWrapper(
    res,
    "",
    "New Address Added Successfully.",
    httpStatus.CREATED,
  );
});

const editAddress = catchAsync(async (req, res) => {
  await orderService.editAddress(req.body, req.params.id);
  return responseWrapper(
    res,
    "",
    "Address Edited Successfully.",
    httpStatus.CREATED,
  );
});

const getAllUserAddress = catchAsync(async (req, res) => {
  const bookings = await orderService.getAllUserAddress(req.body);
  return responseWrapper(res, bookings, "");
});

const getAllBuinessAddress = catchAsync(async (req, res) => {
  const bookings = await orderService.getAllBuinessAddress(req.body);
  return responseWrapper(res, bookings, "");
});

const getBuinessAddressById = catchAsync(async (req, res) => {
  const bookings = await orderService.getBuinessAddressById(req.params.id);
  return responseWrapper(res, bookings, "");
});

const deleteAddress = catchAsync(async (req, res) => {
  let response = await orderService.deleteAddress(req.body, req.params.id);
  return responseWrapper(res, response, "Address Deleted.", httpStatus.OK);
});

const checkAddressProvided = catchAsync(async (req, res) => {
  const response = await orderService.checkAddressProvided(req.body);
  return responseWrapper(res, response, "", httpStatus.OK);
});

const getAllProfessionalOrders = catchAsync(async (req, res) => {
  const bookings = await orderService.getAllProfessionalOrders(req.body);
  return responseWrapper(res, bookings, "");
});

const getAllOrders = catchAsync(async (req, res) => {
  const bookings = await orderService.getAllOrders();
  return responseWrapper(res, bookings, "");
});

const getOrderById = catchAsync(async (req, res) => {
  const bookings = await orderService.getOrderById(req.params.id);
  return responseWrapper(res, bookings, "");
});

const updateOrderStatus = catchAsync(async (req, res) => {
  await orderService.updateOrderStatus(req.params.id, req.body);
  return responseWrapper(
    res,
    "",
    "Order Updated Successfully.",
    httpStatus.CREATED,
  );
});

const getShipmentStatus = catchAsync(async (req, res) => {
  const bookings = await orderService.getShipmentStatus(req.params.id);
  return responseWrapper(res, bookings, "");
});

const createShipmentLabel = catchAsync(async (req, res) => {
  const bookings = await orderService.createShipmentLabel(req.params.id);
  return responseWrapper(res, bookings, "");
});


const addNewAddressPublic = catchAsync(async (req, res) => {
  const data = await orderService.addNewAddressPublic(req.body);

  return responseWrapper(
    res,
    data,
    "New Address Added Successfully.",
    httpStatus.CREATED,
  );
});

const editAddressPublic = catchAsync(async (req, res) => {
  const data = await orderService.editAddressPublic(req.body, req.params.id);

  return responseWrapper(
    res,
    data,
    "Address Edited Successfully.",
    httpStatus.OK,
  );
});

const getAddressByBusinessCardIdPublic = catchAsync(async (req, res) => {
  const data =
    await orderService.getAddressByBusinessCardIdPublic(
      req.params.business_card_id,
    );

  return responseWrapper(
    res,
    data,
    "Address fetched successfully.",
    httpStatus.OK,
  );
});

module.exports = {
  createOrder,
  getAllUserOrders,
  addNewAddress,
  editAddress,
  getAllUserAddress,
  deleteAddress,
  getAllBuinessAddress,
  getBuinessAddressById,
  checkAddressProvided,
  getAllOrders,
  getAllProfessionalOrders,
  getOrderById,
  updateOrderStatus,
  getShipmentStatus,
  createShipmentLabel,

  addNewAddressPublic,
  editAddressPublic,
  getAddressByBusinessCardIdPublic
};
