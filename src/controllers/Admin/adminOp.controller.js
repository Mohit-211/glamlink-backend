/** @format */

const httpStatus = require("http-status");
const catchAsync = require("../../utils/catchAsync");
const ApiError = require("../../utils/ApiError");
const { adminOpService } = require("../../services");
const responseWrapper = require("../../config/responseWrapper");
const pick = require("../../utils/pick");
const config = require("../../config/config");

const getAdminProfile = catchAsync(async (req, res) => {
	const response = await adminOpService.getAdminProfile(req.body, req.query);
	return responseWrapper(res, response, "");
});

const updateAdminProfile = catchAsync(async (req, res) => {
	const response = await adminOpService.updateAdminProfile(
		req.body,
		req.params
	);
	return responseWrapper(res, response, "");
});

const deleteAdmin = catchAsync(async (req, res) => {
	const response = await adminOpService.deleteAdmin(req.body);
	return responseWrapper(res, response, "");
});

const getAllAdmin = catchAsync(async (req, res) => {
	
	const response = await adminOpService.getAllAdmin(req.bodyy);
	return responseWrapper(res, response, "");
});

const approvedUserProfile = catchAsync(async (req, res) => {
	const response = await adminOpService.approvedUserProfile(req.body);
	return responseWrapper(res, response, "");
});

const getAllPriceChangeRequest = catchAsync(async (req, res) => {
	const query = pick(req.query, ["limit", "sortBy", "offset", "page"]);
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
	const response = await adminOpService.getAllPriceChangeRequest(query);
	return responseWrapper(res, response, "");
});

const approvedUserPriceChangeRequest = catchAsync(async (req, res) => {
	const response = await adminOpService.approvedUserPriceChangeRequest(
		req.body
	);
	return responseWrapper(res, response, "Success");
});

const getAllCounselorApprovalRequest = catchAsync(async (req, res) => {
	const response = await adminOpService.getAllCounselorApprovalRequest(
		req.body
	);
	return responseWrapper(res, response, "Success");
});

const rejectUserPriceChangeRequest = catchAsync(async (req, res) => {
	const response = await adminOpService.rejectUserPriceChangeRequest(req.body);
	return responseWrapper(res, response, "Success");
});

const getTotalCounts = catchAsync(async (req, res) => {
	const response = await adminOpService.getTotalCounts(req.body);
	return responseWrapper(res, response, "Success");
});

const getAllTransaction = catchAsync(async (req, res) => {
	const response = await adminOpService.getAllTransaction(
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
	const response = await adminOpService.getAllUsers(param, query);
	return responseWrapper(res, response, "");
});

const getUserById = catchAsync(async (req, res) => {
	const categoryDoc = await adminOpService.getUserById(req.params.id);
	return responseWrapper(res, categoryDoc, "");
});

const deleteUser = catchAsync(async (req, res) => {
	const response = await adminOpService.deleteUser(req.body);
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
	const response = await adminOpService.getAllTransactionAdminPanel(
		body,
		header,
		query
	);
	return responseWrapper(res, response, "");
});

const getAllAppointment = catchAsync(async (req, res) => {
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
	const response = await adminOpService.getAllAppointment(body, header, query);
	return responseWrapper(res, response, "");
});

const getDefaultPrices = catchAsync(async (req, res) => {
	const response = await adminOpService.getDefaultPrices();
	return responseWrapper(res, response, "Success");
});

const getUserLoginTimings = catchAsync(async (req, res) => {
	const response = await adminOpService.getUserLoginTimings();
	return responseWrapper(res, response, "Success");
});

const clearLoginRecords = catchAsync(async (req, res) => {
	const response = await adminOpService.clearLoginRecords();
	return responseWrapper(res, response, "Login records cleared successfully");
});

const getAllPermission = catchAsync(async (req, res) => {
	const response = await adminOpService.getAllPermission(
		req.query.id ? req.query.id : null
	);
	return responseWrapper(res, response, "Success");
});

const updatePermissionByUserId = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user", "permissionIds", "userId"]);
	const response = await adminOpService.updatePermissionByUserId(body);
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
	const response = await adminOpService.createUser(body);
	return responseWrapper(res, response, "New user created.", 201);
});

const getAllPost = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user"]);
	const query = pick(req.query, ["sortBy", "limit", "page"]);
	const params = pick(req.params, []);
	const headers = pick(req.headers, ["timezone"]);

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
	if (!headers["timezone"] || headers["timezone"] === "") {
		headers["timezone"] = config.DEFAULT_TIMEZONE;
	}

	const response = await adminOpService.getAllPost(
		body,
		query,
		params,
		headers
	);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const deletePostById = catchAsync(async (req, res) => {
	await adminOpService.deletePostById(req.body);
	return responseWrapper(res, "", "Post Deleted Successfully", httpStatus.OK);
});

const getAllReel = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user"]);
	const query = pick(req.query, ["sortBy", "limit", "page"]);
	const params = pick(req.params, []);
	const headers = pick(req.headers, ["timezone"]);

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
	if (!headers["timezone"] || headers["timezone"] === "") {
		headers["timezone"] = config.DEFAULT_TIMEZONE;
	}

	const response = await adminOpService.getAllReel(
		body,
		query,
		params,
		headers
	);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const deleteReelById = catchAsync(async (req, res) => {
	await adminOpService.deleteReelById(req.body);
	return responseWrapper(res, "", "Reel Deleted Successfully", httpStatus.OK);
});

const getAllService = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user"]);
	const query = pick(req.query, ["sortBy", "limit", "page"]);
	const params = pick(req.params, []);
	const headers = pick(req.headers, ["timezone"]);

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
	if (!headers["timezone"] || headers["timezone"] === "") {
		headers["timezone"] = config.DEFAULT_TIMEZONE;
	}

	const response = await adminOpService.getAllService(
		body,
		query,
		params,
		headers
	);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const deleteServiceById = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user"]);
	const params = pick(req.params, ["id"]);
	await adminOpService.deleteServiceById(body, params);
	return responseWrapper(
		res,
		"",
		"Service Deleted Successfully",
		httpStatus.OK
	);
});

const promotedToogle = catchAsync(async (req, res) => {
	// const body = pick(req.body, ["user", "user_id"]);
	const response = await adminOpService.promotedToogle(req.body);
	// message =
	// 	response.is_promoted === true
	// 		? "User is promoted now!"
	// 		: "User is not promoted";
	return responseWrapper(res, response, "", httpStatus.OK);
});

const unpromote = catchAsync(async (req, res) => {
	const response = await adminOpService.unpromote(req.body);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const unpromoteAll = catchAsync(async (req, res) => {
	const response = await adminOpService.unpromoteAll(req.body);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const getUserPromotions = catchAsync(async (req, res) => {
	const response = await adminOpService.getUserPromotions(req.params.id);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const getAllPromotionRequest = catchAsync(async (req, res) => {
	const response = await adminOpService.getAllPromotionRequest(req.body);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const createServiceList = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user", "category_id", "title", "description"]);
	const response = await adminOpService.createServiceList(body);
	return responseWrapper(res, "", response);
});

const createServiceListUsingCSV = catchAsync(async (req, res) => {
	const response = await adminOpService.createServiceListUsingCSV(req.body);
	return responseWrapper(res, "", response);
});

const updateServiceList = catchAsync(async (req, res) => {
	const response = await adminOpService.updateServiceList(
		req.body,
		req.params.id
	);
	return responseWrapper(
		res,
		response,
		"Service List Updated Successfully.",
		httpStatus.OK
	);
});

const deleteServiceList = catchAsync(async (req, res) => {
	await adminOpService.deleteServiceList(req.body);
	return responseWrapper(res, "", "Service List Deleted.", httpStatus.OK);
});

const foundersToogle = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user", "user_id"]);
	const response = await adminOpService.foundersToogle(body);
	message =
		response.is_promoted === true
			? "User is promoted now!"
			: "User is not promoted";
	return responseWrapper(res, "", message);
});

const getAllReferral = catchAsync(async (req, res) => {
	const response = await adminOpService.getAllReferral();
	return responseWrapper(res, response, "", httpStatus.OK);
});

const getAllReferralByBeauticianId = catchAsync(async (req, res) => {
	const response = await adminOpService.getAllReferralByBeauticianId(req.params.id);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const getAllGlamCoinRules = catchAsync(async (req, res) => {
	const response = await adminOpService.getAllGlamCoinRules();
	return responseWrapper(res, response, "", httpStatus.OK);
});

const editGlamCoinRules = catchAsync(async (req, res) => {
	const response = await adminOpService.editGlamCoinRules(req.body, req.params.id);
	return responseWrapper(res, response, "", httpStatus.OK);
});


module.exports = {
	getAdminProfile,
	updateAdminProfile,
	getAllAdmin,
	deleteAdmin,
	approvedUserProfile,
	getAllPriceChangeRequest,
	approvedUserPriceChangeRequest,
	rejectUserPriceChangeRequest,
	getAllCounselorApprovalRequest,
	getTotalCounts,
	getAllTransaction,
	getAllTransaction,
	getAllUsers,
	getUserById,
	deleteUser,
	getAllTransactionAdminPanel,
	getAllAppointment,
	getDefaultPrices,
	getUserLoginTimings,
	clearLoginRecords,
	getAllPermission,
	updatePermissionByUserId,
	createUser,
	getAllPost,
	deletePostById,
	getAllReel,
	deleteReelById,
	getAllService,
	deleteServiceById,
	promotedToogle,
    getAllPromotionRequest,

	createServiceList,
	updateServiceList,
	deleteServiceList,
	createServiceListUsingCSV,
	foundersToogle,
	unpromote,
	unpromoteAll,
	getUserPromotions,
	getAllReferral,
	getAllReferralByBeauticianId,
	getAllGlamCoinRules,
	editGlamCoinRules
};
