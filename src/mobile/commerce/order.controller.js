const httpStatus = require("../../core/http/status");
const catchAsync = require("../../core/http/catchAsync");
const orderService = require("./order.service");
const responseWrapper = require("../../core/http/responseWrapper");

const getAllUserOrders = catchAsync(async (req, res) => {
  const bookings = await orderService.getAllUserOrders(req.body);
  return responseWrapper(res, bookings, "");
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

module.exports = {
    getAllUserOrders,
    getAllOrders,
    getAllProfessionalOrders,
    getOrderById,
    updateOrderStatus,
    getShipmentStatus,
    createShipmentLabel,
};
