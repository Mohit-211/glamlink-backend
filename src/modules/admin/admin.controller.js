/** @format */

const catchAsync = require("../../core/http/catchAsync");
const adminService = require("./admin.service");
const responseWrapper = require("../../core/http/responseWrapper");
const pick = require("../../core/utils/pick");
const config = require("../../core/config/config");

const getAdminProfile = catchAsync(async (req, res) => {
	const response = await adminService.getAdminProfile(req.body, req.query);
	return responseWrapper(res, response, "");
});

const updateAdminProfile = catchAsync(async (req, res) => {
	const response = await adminService.updateAdminProfile(
		req.body,
		req.params
	);
	return responseWrapper(res, response, "");
});

const deleteAdmin = catchAsync(async (req, res) => {
	const response = await adminService.deleteAdmin(req.body);
	return responseWrapper(res, response, "");
});

const getAllAdmin = catchAsync(async (req, res) => {
	
	const response = await adminService.getAllAdmin(req.bodyy);
	return responseWrapper(res, response, "");
});

const approvedUserProfile = catchAsync(async (req, res) => {
	const response = await adminService.approvedUserProfile(req.body);
	return responseWrapper(res, response, "");
});

const getTotalCounts = catchAsync(async (req, res) => {
	const response = await adminService.getTotalCounts(req.body);
	return responseWrapper(res, response, "Success");
});

const getAllTransaction = catchAsync(async (req, res) => {
	const response = await adminService.getAllTransaction(
		req.body,
		req.headers
	);
	return responseWrapper(res, response, "Success");
});

const getAllUsers = catchAsync(async (req, res) => {
	const query = pick(req.query, ["limit", "sortBy", "offset", "page"]);
	const param = pick(req.params, ["roleId"]);

	if (!query["limit"]) {
		query["limit"] = config.defaultLimit;
	}
	if (!query["page"]) {
		query["page"] = 1;
	}
	if (!query["sortBy"] || query["sortBy"] === "") {
		query["sortBy"] = "ASC";
	}
	let offset = (query["page"] - 1) * query["limit"];
	query["offset"] = offset;
	const response = await adminService.getAllUsers(param, query);
	return responseWrapper(res, response, "");
});

const getUserById = catchAsync(async (req, res) => {
	const categoryDoc = await adminService.getUserById(req.params.id);
	return responseWrapper(res, categoryDoc, "");
});

const deleteUser = catchAsync(async (req, res) => {
	const response = await adminService.deleteUser(req.body);
	return responseWrapper(res, response, "");
});

const getAllTransactionAdminPanel = catchAsync(async (req, res) => {
	const query = pick(req.query, ["limit", "sortBy", "offset", "page"]);
	const header = pick(req.headers, ["timezone"]);
	const body = pick(req.body, ["user"]);

	if (!query["limit"]) {
		query["limit"] = config.defaultLimit;
	}
	if (!query["page"]) {
		query["page"] = 1;
	}
	if (!query["sortBy"] || query["sortBy"] === "") {
		query["sortBy"] = "ASC";
	}
	let offset = (query["page"] - 1) * query["limit"];
	query["offset"] = offset;
	const response = await adminService.getAllTransactionAdminPanel(
		body,
		header,
		query
	);
	return responseWrapper(res, response, "");
});

const getUserLoginTimings = catchAsync(async (req, res) => {
	const response = await adminService.getUserLoginTimings();
	return responseWrapper(res, response, "Success");
});

const clearLoginRecords = catchAsync(async (req, res) => {
	const response = await adminService.clearLoginRecords();
	return responseWrapper(res, response, "Login records cleared successfully");
});

const getAllPermission = catchAsync(async (req, res) => {
	const response = await adminService.getAllPermission(
		req.query.id ? req.query.id : null
	);
	return responseWrapper(res, response, "Success");
});

const updatePermissionByUserId = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user", "permissionIds", "userId"]);
	const response = await adminService.updatePermissionByUserId(body);
	return responseWrapper(res, response, "Success");
});

const createUser = catchAsync(async (req, res) => {
	const body = pick(req.body, [
		"name",
		"email",
		"mobile",
		"password",
		"confirm_password",
		"city_id",
		"state_id",
		"role_id",
		"user",
	]);
	const response = await adminService.createUser(body);
	return responseWrapper(res, response, "New user created.", 201);
});

const foundersToggle = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user", "user_id"]);
	const response = await adminService.foundersToggle(body);
	const message =
		response.is_promoted === true
			? "User is promoted now!"
			: "User is not promoted";
	return responseWrapper(res, "", message);
});

module.exports = {
    getAdminProfile,
    updateAdminProfile,
    getAllAdmin,
    deleteAdmin,
    approvedUserProfile,
    getTotalCounts,
    getAllTransaction,
    getAllUsers,
    getUserById,
    deleteUser,
    getAllTransactionAdminPanel,
    getUserLoginTimings,
    clearLoginRecords,
    getAllPermission,
    updatePermissionByUserId,
    createUser,
    foundersToggle,
};
