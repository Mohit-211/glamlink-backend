const httpStatus = require("../../core/http/status");
const catchAsync = require("../../core/http/catchAsync");
const addressService = require("./address.service");
const responseWrapper = require("../../core/http/responseWrapper");

const addNewAddress = catchAsync(async (req, res) => {
  await addressService.addNewAddress(req.body, req.headers);
  return responseWrapper(
    res,
    "",
    "New Address Added Successfully.",
    httpStatus.CREATED,
  );
});

const editAddress = catchAsync(async (req, res) => {
  await addressService.editAddress(req.body, req.params.id);
  return responseWrapper(
    res,
    "",
    "Address Edited Successfully.",
    httpStatus.CREATED,
  );
});

const getAllUserAddress = catchAsync(async (req, res) => {
  const bookings = await addressService.getAllUserAddress(req.body);
  return responseWrapper(res, bookings, "");
});

const getAllBusinessAddress = catchAsync(async (req, res) => {
  const bookings = await addressService.getAllBusinessAddress(req.body);
  return responseWrapper(res, bookings, "");
});

const getBusinessAddressById = catchAsync(async (req, res) => {
  const bookings = await addressService.getBusinessAddressById(req.params.id);
  return responseWrapper(res, bookings, "");
});

const deleteAddress = catchAsync(async (req, res) => {
  let response = await addressService.deleteAddress(req.body, req.params.id);
  return responseWrapper(res, response, "Address Deleted.", httpStatus.OK);
});

const checkAddressProvided = catchAsync(async (req, res) => {
  const response = await addressService.checkAddressProvided(req.body);
  return responseWrapper(res, response, "", httpStatus.OK);
});

module.exports = {
    addNewAddress,
    editAddress,
    getAllUserAddress,
    deleteAddress,
    getAllBusinessAddress,
    getBusinessAddressById,
    checkAddressProvided,
};
