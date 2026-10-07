/** @format */

const httpStatus = require("http-status");

const catchAsync = require("../../utils/catchAsync");
const { partnershipInquiryService } = require("../../services/Common");
const responseWrapper = require("../../config/responseWrapper");

const createPartnershipInquiry = catchAsync(async (req, res) => {
  const inquiry =
    await partnershipInquiryService.createPartnershipInquiry(req.body);

  return responseWrapper(
    res,
    inquiry,
    "Partnership inquiry submitted successfully",
    httpStatus.CREATED,
  );
});

const getAllPartnershipInquiries = catchAsync(async (req, res) => {
  const inquiries =
    await partnershipInquiryService.getAllPartnershipInquiries();

  return responseWrapper(res, inquiries, "");
});

const findPartnershipInquiryById = catchAsync(async (req, res) => {
  const inquiry =
    await partnershipInquiryService.findPartnershipInquiryById(
      req.params.id,
    );

  return responseWrapper(res, inquiry, "");
});

const deletePartnershipInquiry = catchAsync(async (req, res) => {
  await partnershipInquiryService.deletePartnershipInquiry(req.body);

  return responseWrapper(
    res,
    "",
    "Partnership inquiry deleted successfully.",
    httpStatus.OK,
  );
});

module.exports = {
  createPartnershipInquiry,
  getAllPartnershipInquiries,
  findPartnershipInquiryById,
  deletePartnershipInquiry,
};