/** @format */

const httpStatus = require("../../core/http/status");
const catchAsync = require("../../core/http/catchAsync");
const cardAddressService = require("./cardAddress.service");
const responseWrapper = require("../../core/http/responseWrapper");

const addNewAddressPublic = catchAsync(async (req, res) => {
  const data = await cardAddressService.addNewAddressPublic(req.body);

  return responseWrapper(
    res,
    data,
    "New Address Added Successfully.",
    httpStatus.CREATED,
  );
});

const editAddressPublic = catchAsync(async (req, res) => {
  const data = await cardAddressService.editAddressPublic(req.body, req.params.id);

  return responseWrapper(
    res,
    data,
    "Address Edited Successfully.",
    httpStatus.OK,
  );
});

const getAddressByBusinessCardIdPublic = catchAsync(async (req, res) => {
  const data =
    await cardAddressService.getAddressByBusinessCardIdPublic(
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
    addNewAddressPublic,
    editAddressPublic,
    getAddressByBusinessCardIdPublic,
};
