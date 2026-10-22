const httpStatus = require("../../core/http/status");
const ApiError = require("../../core/http/ApiError");
const catchAsync = require("../../core/http/catchAsync");
const responseWrapper = require("../../core/http/responseWrapper");
const discoverService = require("./discover.service");
const { identifyAdmin } = require("../../shared/admin");

// With any list parameter, GET /discover/shop answers one page of products (discover.service.js listShop);
// without, every published item, as before.
const SHOP_LIST_PARAMETERS = ["page", "limit", "category", "brand", "owner", "search", "featured"];

const createDiscover = catchAsync(async (req, res) => {
	const data = await discoverService.createDiscover(
		req.params.type,
		req.body,
		req.files
	);

	return responseWrapper(
		res,
		data,
		`${req.params.type} created successfully.`,
		httpStatus.CREATED
	);
});

const getAllDiscover = catchAsync(async (req, res) => {
	const paged = req.params.type === "shop" && SHOP_LIST_PARAMETERS.some((key) => req.query[key] !== undefined);
	const data = paged ? await discoverService.listShop(req.query) : await discoverService.getAllDiscover(req.params.type);

	return responseWrapper(res, data, "");
});

const getShopFilters = catchAsync(async (req, res) => {
	const data = await discoverService.shopFilters();

	return responseWrapper(res, data, "");
});

const getAllDiscoverByAdmin = catchAsync(async (req, res) => {
	const data = await discoverService.getAllDiscoverByAdmin(req.params.type);

	return responseWrapper(res, data, "");
});

const findDiscoverById = catchAsync(async (req, res) => {
	const withDrafts = Boolean(await identifyAdmin(req));
	const data = await discoverService.findDiscoverById(
		req.params.type,
		req.params.id,
		{ withDrafts }
	);

	return responseWrapper(res, data, "");
});

const findProductBySlug = catchAsync(async (req, res) => {
	const withDrafts = Boolean(await identifyAdmin(req));
	const data = await discoverService.findProductBySlug(req.params.slug, { withDrafts });

	return responseWrapper(res, data, "");
});

const updateDiscover = catchAsync(async (req, res) => {
	const data = await discoverService.updateDiscover(
		req.params.type,
		req.body,
		req.params.id,
		req.files
	);

	return responseWrapper(
		res,
		data,
		`${req.params.type} updated successfully.`
	);
});

const deleteDiscover = catchAsync(async (req, res) => {
	await discoverService.deleteDiscover(
		req.params.type,
		req.body
	);

	return responseWrapper(
		res,
		"",
		"Delete Successful.",
		httpStatus.OK
	);
});

const updateDiscoverSortOrder = catchAsync(async (req, res) => {
	await discoverService.updateDiscoverSortOrder(
		req.params.type,
		req.body
	);

	return responseWrapper(
		res,
		"",
		"Sort order updated successfully.",
		httpStatus.OK
	);
});

const bulkUploadDiscoverCsv = catchAsync(async (req, res) => {
  if (req.params.type !== "shop") {
    throw new ApiError(httpStatus.BAD_REQUEST, "CSV upload is only supported for type=shop");
  }

  const csvFile = req.files?.csv_file?.[0];
  if (!csvFile) {
    throw new ApiError(httpStatus.BAD_REQUEST, "CSV file is required");
  }

  const data = await discoverService.bulkUploadShopCsv(csvFile.path);

  return responseWrapper(res, data, "CSV processed successfully.", httpStatus.CREATED);
});



module.exports = {
	createDiscover,
	getAllDiscover,
	getShopFilters,
	getAllDiscoverByAdmin,
	findDiscoverById,
	findProductBySlug,
	updateDiscover,
	deleteDiscover,
	updateDiscoverSortOrder,
	bulkUploadDiscoverCsv
};