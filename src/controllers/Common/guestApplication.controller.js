/** @format */

const httpStatus = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const { guestApplicationService } = require("../../services");
const responseWrapper = require("../../config/responseWrapper");

const createGuestApplication = catchAsync(async (req, res) => {
  const response = await guestApplicationService.createGuestApplication(
    req.body
  );
  return responseWrapper(
    res,
    response,
    "Application Submitted Successfully.",
    httpStatus.CREATED
  );
});

const getAllGuestApplications = catchAsync(async (req, res) => {
  const response = await guestApplicationService.getAllGuestApplications();
  return responseWrapper(res, response, "", httpStatus.OK);
});

const getGuestApplicationById = catchAsync(async (req, res) => {
  const response =
    await guestApplicationService.getGuestApplicationById(
      req.params.id
    );
  return responseWrapper(res, response, "", httpStatus.OK);
});

const deleteGuestApplication = catchAsync(async (req, res) => {
  await guestApplicationService.deleteGuestApplication(req.body);
  res.status(httpStatus.OK).send({
    code: httpStatus.NO_CONTENT,
    message: "Deleted Successfully.",
    data: "",
  });
});

module.exports = {
  createGuestApplication,
  getAllGuestApplications,
  getGuestApplicationById,
  deleteGuestApplication,
};