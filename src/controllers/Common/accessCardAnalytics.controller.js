const httpStatus = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const { accessCardAnalyticsService } = require("../../services");
const responseWrapper = require("../../config/responseWrapper");

const trackAccessCardEvent = catchAsync(async (req, res) => {
  const response = await accessCardAnalyticsService.trackAccessCardEvent(
    req,
    req.body,
  );

  return responseWrapper(
    res,
    response,
    "Access card analytics event tracked successfully.",
    httpStatus.CREATED,
  );
});

const getAccessCardAnalytics = catchAsync(async (req, res) => {
  const response = await accessCardAnalyticsService.getAccessCardAnalytics(
    req.params.businessCardId,
    req.query,
  );

  return responseWrapper(
    res,
    response,
    "Access card analytics fetched successfully.",
    httpStatus.OK,
  );
});

const getAccessCardAnalyticsEvents = catchAsync(async (req, res) => {
  const response =
    await accessCardAnalyticsService.getAccessCardAnalyticsEvents(
      req.params.businessCardId,
      req.query,
    );

  return responseWrapper(
    res,
    response,
    "Access card analytics events fetched successfully.",
    httpStatus.OK,
  );
});

const getAccessCardAnalyticsOverview = catchAsync(async (req, res) => {
  const response =
    await accessCardAnalyticsService.getAccessCardAnalyticsOverview(req.query);

  return responseWrapper(
    res,
    response,
    "Access card analytics overview fetched successfully.",
    httpStatus.OK,
  );
});

module.exports = {
  trackAccessCardEvent,
  getAccessCardAnalytics,
  getAccessCardAnalyticsEvents,
  getAccessCardAnalyticsOverview,
};
