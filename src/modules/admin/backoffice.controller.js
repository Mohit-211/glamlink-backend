/** @format */

const httpStatus = require("../../core/http/status");
const catchAsync = require("../../core/http/catchAsync");
const backofficeService = require("./backoffice.service");
const responseWrapper = require("../../core/http/responseWrapper");
const pick = require("../../core/utils/pick");
const config = require("../../core/config/config");

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
	const response = await backofficeService.getAllAppointment(body, header, query);
	return responseWrapper(res, response, "");
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

	const response = await backofficeService.getAllPost(
		body,
		query,
		params,
		headers
	);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const deletePostById = catchAsync(async (req, res) => {
	await backofficeService.deletePostById(req.body);
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

	const response = await backofficeService.getAllReel(
		body,
		query,
		params,
		headers
	);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const deleteReelById = catchAsync(async (req, res) => {
	await backofficeService.deleteReelById(req.body);
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

	const response = await backofficeService.getAllService(
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
	await backofficeService.deleteServiceById(body, params);
	return responseWrapper(
		res,
		"",
		"Service Deleted Successfully",
		httpStatus.OK
	);
});

const promotedToggle = catchAsync(async (req, res) => {
	const response = await backofficeService.promotedToggle(req.body);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const unpromote = catchAsync(async (req, res) => {
	const response = await backofficeService.unpromote(req.body);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const unpromoteAll = catchAsync(async (req, res) => {
	const response = await backofficeService.unpromoteAll(req.body);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const getUserPromotions = catchAsync(async (req, res) => {
	const response = await backofficeService.getUserPromotions(req.params.id);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const getAllPromotionRequest = catchAsync(async (req, res) => {
	const response = await backofficeService.getAllPromotionRequest(req.body);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const createServiceList = catchAsync(async (req, res) => {
	const body = pick(req.body, ["user", "category_id", "title", "description"]);
	const response = await backofficeService.createServiceList(body);
	return responseWrapper(res, "", response);
});

const createServiceListUsingCSV = catchAsync(async (req, res) => {
	const response = await backofficeService.createServiceListUsingCSV(req.body);
	return responseWrapper(res, "", response);
});

const updateServiceList = catchAsync(async (req, res) => {
	const response = await backofficeService.updateServiceList(
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
	await backofficeService.deleteServiceList(req.body);
	return responseWrapper(res, "", "Service List Deleted.", httpStatus.OK);
});

const getAllReferral = catchAsync(async (req, res) => {
	const response = await backofficeService.getAllReferral();
	return responseWrapper(res, response, "", httpStatus.OK);
});

const getAllReferralByProfessionalId = catchAsync(async (req, res) => {
	const response = await backofficeService.getAllReferralByProfessionalId(req.params.id);
	return responseWrapper(res, response, "", httpStatus.OK);
});

const getAllGlamCoinRules = catchAsync(async (req, res) => {
	const response = await backofficeService.getAllGlamCoinRules();
	return responseWrapper(res, response, "", httpStatus.OK);
});

const editGlamCoinRules = catchAsync(async (req, res) => {
	const response = await backofficeService.editGlamCoinRules(req.body, req.params.id);
	return responseWrapper(res, response, "", httpStatus.OK);
});

module.exports = {
    getAllAppointment,
    getAllPost,
    deletePostById,
    getAllReel,
    deleteReelById,
    getAllService,
    deleteServiceById,
    promotedToggle,
    getAllPromotionRequest,
    createServiceList,
    updateServiceList,
    deleteServiceList,
    createServiceListUsingCSV,
    unpromote,
    unpromoteAll,
    getUserPromotions,
    getAllReferral,
    getAllReferralByProfessionalId,
    getAllGlamCoinRules,
    editGlamCoinRules,
};
