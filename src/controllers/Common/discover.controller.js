/** @format */

const httpStatus = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const responseWrapper = require("../../config/responseWrapper");
const { discoverService } = require("../../services/Common");

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
	const data = await discoverService.getAllDiscover(req.params.type);

	return responseWrapper(res, data, "");
});

const getAllDiscoverByAdmin = catchAsync(async (req, res) => {
	const data = await discoverService.getAllDiscoverByAdmin(req.params.type);

	return responseWrapper(res, data, "");
});

const findDiscoverById = catchAsync(async (req, res) => {
	const data = await discoverService.findDiscoverById(
		req.params.type,
		req.params.id
	);

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
	getAllDiscoverByAdmin,
	findDiscoverById,
	updateDiscover,
	deleteDiscover,
	updateDiscoverSortOrder,
	bulkUploadDiscoverCsv
};