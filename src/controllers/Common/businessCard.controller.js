/** @format */

const httpStatus = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const { businessCardService } = require("../../services");
const responseWrapper = require("../../config/responseWrapper");
const pick = require("../../utils/pick");

const createBusinessCard = catchAsync(async (req, res) => {
  const response = await businessCardService.createBusinessCard(
    req.body,
    req.files,
  );
  return responseWrapper(
    res,
    response,
    "Business card created.",
    httpStatus.CREATED,
  );
});

const selectBusinessCardPlan = catchAsync(async (req, res) => {
  const response = await businessCardService.selectBusinessCardPlan(req.body);

  return responseWrapper(
    res,
    response,
    "Plan selected successfully.",
    httpStatus.OK,
  );
});

const createBusinessCardByAdmin = catchAsync(async (req, res) => {
  const response = await businessCardService.createBusinessCardByAdmin(
    req.body,
    req.files,
  );
  return responseWrapper(
    res,
    response,
    "Business card created.",
    httpStatus.CREATED,
  );
});

const createBusinessCardWithToken = catchAsync(async (req, res) => {
  const response = await businessCardService.createBusinessCardWithToken(
    req.body,
    req.files,
  );
  return responseWrapper(
    res,
    response,
    "Business card created.",
    httpStatus.CREATED,
  );
});

const getMyBusinessCard = catchAsync(async (req, res) => {
  const response = await businessCardService.getMyBusinessCard(req.body);
  return responseWrapper(res, response, "", httpStatus.OK);
});

const getBusinessCardById = catchAsync(async (req, res) => {
  const response = await businessCardService.getBusinessCardById(req.params.id);
  return responseWrapper(res, response, "", httpStatus.OK);
});

const updateBusinessCard = catchAsync(async (req, res) => {
  const response = await businessCardService.updateBusinessCard(
    req.params.id,
    req.body,
    req.files,
  );
  return responseWrapper(res, response, "", httpStatus.OK);
});

const reorderFeaturedLinks = catchAsync(async (req, res) => {
  const directoryDoc = await businessCardService.reorderFeaturedLinks(
    req.params.id,
    req.body,
  );

  return responseWrapper(
    res,
    directoryDoc,
    "Featured Links Reordered Successfully",
  );
});

const deleteBusinessCard = catchAsync(async (req, res) => {
  await businessCardService.deleteBusinessCard(req.body);
  return responseWrapper(res, "", "Delete Successfull.", httpStatus.OK);
});

const getBusinessCard = catchAsync(async (req, res) => {
  const response = await businessCardService.getBusinessCard(req.params.slug);
  return responseWrapper(res, response, "", httpStatus.OK);
});

const getAllProfiles = catchAsync(async (req, res) => {
  const response = await businessCardService.getAllProfiles();
  return responseWrapper(res, response, "", httpStatus.OK);
});

const filterBusinessCards = catchAsync(async (req, res) => {
  const response = await businessCardService.filterBusinessCards(req.query);
  return responseWrapper(res, response, "", httpStatus.OK);
});

const searchBusinessCards = catchAsync(async (req, res) => {
  const response = await businessCardService.searchBusinessCards(req.query);
  return responseWrapper(res, response, "", httpStatus.OK);
});

const getAllBusinessCards = catchAsync(async (req, res) => {
  const response = await businessCardService.getAllBusinessCards();
  return responseWrapper(res, response, "", httpStatus.OK);
});

const updateBusinessCardStatus = catchAsync(async (req, res) => {
  const response = await businessCardService.updateBusinessCardStatus(req.body);
  return responseWrapper(res, response, "", httpStatus.OK);
});

// business category

const createCategory = catchAsync(async (req, res) => {
  const body = pick(req.body, ["title"]);
  const categoryDoc = await businessCardService.createCategory(body);
  return responseWrapper(
    res,
    categoryDoc,
    "New category Created Successfully",
    httpStatus.CREATED,
  );
});

const getAllCategories = catchAsync(async (req, res) => {
  const categorys = await businessCardService.getAllCategories();
  return responseWrapper(res, categorys, "");
});

const updateCategory = catchAsync(async (req, res) => {
  const body = pick(req.body, ["title", "description"]);
  const categoryDoc = await businessCardService.updateCategory(
    body,
    req.params.id,
  );
  return responseWrapper(res, categoryDoc, "Category Update Successfully");
});

const findCategoryById = catchAsync(async (req, res) => {
  const categoryDoc = await businessCardService.findCategoryById(req.params.id);
  return responseWrapper(res, categoryDoc, "");
});

const deleteCategory = catchAsync(async (req, res) => {
  await businessCardService.deleteCategory(req.body);
  return responseWrapper(res, "", "Delete Successfull.", httpStatus.OK);
});

//directory category

const createDirectory = catchAsync(async (req, res) => {
  const categoryDoc = await businessCardService.createDirectory(
    req.body,
    req.files,
  );
  return responseWrapper(
    res,
    categoryDoc,
    "New category Created Successfully",
    httpStatus.CREATED,
  );
});

const updateDirectory = catchAsync(async (req, res) => {
  const directoryDoc = await businessCardService.updateDirectory(
    req.params.id,
    req.body,
    req.files,
  );
  return responseWrapper(res, directoryDoc, "Directory Update Successfully");
});

const deleteDirectory = catchAsync(async (req, res) => {
  await businessCardService.deleteDirectory(req.body);
  return responseWrapper(res, "", "Delete Successfull.", httpStatus.OK);
});

const getAllDirectories = catchAsync(async (req, res) => {
  const categorys = await businessCardService.getAllDirectories();
  return responseWrapper(res, categorys, "");
});

const getProfilesByDirectory = catchAsync(async (req, res) => {
  const categorys = await businessCardService.getProfilesByDirectory(
    req.params.id,
  );
  return responseWrapper(res, categorys, "");
});

const selectBusinessCardAddress = catchAsync(async (req, res) => {
  const response = await businessCardService.selectBusinessCardAddress(
    req.body,
  );

  return responseWrapper(
    res,
    response,
    "Address linked successfully.",
    httpStatus.OK,
  );
});

const getBusinessCardShippingRate = catchAsync(async (req, res) => {
  const response = await businessCardService.getBusinessCardShippingRate(
    req.body,
  );

  return responseWrapper(res, response, "Shipping calculated successfully");
});

const getBusinessCardShippingRatePublic = catchAsync(async (req, res) => {
  const response = await businessCardService.getBusinessCardShippingRatePublic(
    req.body,
  );

  return responseWrapper(res, response, "Shipping calculated successfully");
});

const createBusinessCardSubscription = catchAsync(async (req, res) => {
  const response = await businessCardService.createBusinessCardSubscription(
    req.body,
  );

  return responseWrapper(
    res,
    response,
    "Subscription created successfully",
    httpStatus.OK,
  );
});

const cancelBusinessCardSubscription = catchAsync(async (req, res) => {
  const data = await businessCardService.cancelBusinessCardSubscription(
    req.body,
  );

  return responseWrapper(res, data, "Subscription cancelled successfully");
});

const createBusinessCardSubscriptionPublic = catchAsync(async (req, res) => {
  const data = await businessCardService.createBusinessCardSubscriptionPublic(
    req.body,
  );

  return responseWrapper(res, data, "Subscription created successfully");
});

const getPaymentHistory = catchAsync(async (req, res) => {
  const response = await businessCardService.getPaymentHistory(req.body.user);

  return responseWrapper(
    res,
    response,
    "Payment history fetched successfully",
    httpStatus.OK,
  );
});

const getAllAccessOrders = catchAsync(async (req, res) => {
  const response = await businessCardService.getAllAccessOrders(req.body);

  return responseWrapper(
    res,
    response,
    "Access orders fetched successfully",
    httpStatus.OK,
  );
});

const getAccessOrderById = catchAsync(async (req, res) => {
  const response = await businessCardService.getAccessOrderById(
    req.params.id,
  );

  return responseWrapper(
    res,
    response,
    "Access order fetched successfully",
    httpStatus.OK,
  );
});

const updateAccessOrderFulfillment = catchAsync(async (req, res) => {
  const response =
    await businessCardService.updateAccessOrderFulfillment(
      req.params.id,
      req.body,
    );

  return responseWrapper(
    res,
    response,
    "Access order fulfillment updated successfully",
    httpStatus.OK,
  );
});

module.exports = {
  createBusinessCard,
  selectBusinessCardPlan,
  createBusinessCardByAdmin,
  createBusinessCardWithToken,
  getMyBusinessCard,
  getBusinessCardById,
  getBusinessCard,
  searchBusinessCards,
  getAllProfiles,
  filterBusinessCards,
  updateBusinessCard,
  deleteBusinessCard,
  getAllBusinessCards,
  updateBusinessCardStatus,
  reorderFeaturedLinks,

  findCategoryById,
  createCategory,
  getAllCategories,
  updateCategory,
  deleteCategory,

  createDirectory,
  updateDirectory,
  deleteDirectory,
  getAllDirectories,
  getProfilesByDirectory,
  selectBusinessCardAddress,
  getBusinessCardShippingRate,
  createBusinessCardSubscription,
  cancelBusinessCardSubscription,
  getPaymentHistory,

  getBusinessCardShippingRatePublic,
  createBusinessCardSubscriptionPublic,

  getAllAccessOrders,
  getAccessOrderById,
  updateAccessOrderFulfillment
};
