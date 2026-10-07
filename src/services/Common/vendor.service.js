/** @format */

const httpStatus = require("http-status");
const moment = require("moment");

const ApiError = require("../../utils/ApiError");
const { Vendor } = require("../../models");

const createVendor = async (reqBody) => {
	try {
		const { user } = reqBody;
		const brandObj = {
			name: reqBody.name,
			contact: reqBody.contact,
			email: reqBody.email,
			address: reqBody.address,
			gst: reqBody.gst,
			user_id: user.id,
			created_at: moment(),
		};

		const brandDoc = await Vendor.create(brandObj);
		if (!brandDoc) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to create new Brand"
			);
		}
		return brandDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllVendor = async (reqBody) => {
	try {
		const { user } = reqBody;
		

		if (user.is_form_filled && (user.form_status === "pending" || user.form_status === null)) {
			throw new ApiError(
				httpStatus.FORBIDDEN,
				"Your form is under review. Please wait for admin approval."
			);
		}

		if (user.is_form_filled && user.form_status === "rejected") {
			throw new ApiError(
				httpStatus.FORBIDDEN,
				"Your form is rejected."
			);
		}

		

		// Check if user has access through any means
		const hasFreeTrialData = user.trial_start_date && user.trial_end_date;
		const hasPremiumData = user.premium_start_date && user.premium_end_date;

		if (!user.is_free_trial && !user.is_premium && !hasFreeTrialData && !hasPremiumData) {
			throw new ApiError(
				httpStatus.FORBIDDEN,
				"You need to start a free trial or purchase a premium plan to access this feature."
			);
		}


		
	
		const brandDoc = await Vendor.findAll({
			where: { is_active: true, user_id: user.id },
		});
		if (!brandDoc) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to get all Brand"
			);
		}
		return brandDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getVendorById = async (id) => {
	try {
		const brandDoc = await Vendor.findOne({
			where: { id: id, is_active: true },
		});
		return brandDoc ? brandDoc : "No Brand Found";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getVendorName = async (reqBody) => {
	try {
		const { user } = reqBody;
		const productCategoryDoc = await Vendor.findAll({
			where: { user_id: user.id, is_active: true },
			attributes: ["id", "name"],
		});
		return productCategoryDoc
			? productCategoryDoc
			: "No Product Category Found";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const updateVendor = async (reqBody, id) => {
	try {
		const brandDoc = await Vendor.findByPk(id);

		if (!brandDoc) {
			throw new ApiError(httpStatus.NOT_FOUND, "Brand not found");
		}
		if (
			reqBody.name &&
			typeof reqBody.name !== "undefined" &&
			reqBody.name !== ""
		) {
			brandDoc["name"] = reqBody.name;
		}

		if (
			reqBody.contact &&
			typeof reqBody.contact !== "undefined" &&
			reqBody.contact !== ""
		) {
			brandDoc["contact"] = reqBody.contact;
		}

		if (
			reqBody.email &&
			typeof reqBody.email !== "undefined" &&
			reqBody.email !== ""
		) {
			brandDoc["email"] = reqBody.email;
		}

		if (
			reqBody.address &&
			typeof reqBody.address !== "undefined" &&
			reqBody.address !== ""
		) {
			brandDoc["address"] = reqBody.address;
		}

		if (
			reqBody.gst &&
			typeof reqBody.gst !== "undefined" &&
			reqBody.gst !== ""
		) {
			brandDoc["gst"] = reqBody.gst;
		}

		await brandDoc.save();
		return brandDoc ? brandDoc : {};
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteVendor = async (body) => {
	try {
		if (!Array.isArray(body.vendor_id) || body.vendor_id.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid brand id");
		}

		// Ensure all IDs are trimmed and filtered
		const brandIds = body.vendor_id
			.map((id) => String(id).trim())
			.filter(Boolean);

		if (brandIds.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "No valid brand IDs provided");
		}

		// Find all blog categories with the given IDs
		const blogCategories = await Vendor.findAll({
			where: {
				id: brandIds,
			},
		});

		if (blogCategories.length === 0) {
			throw new ApiError(httpStatus.NOT_FOUND, "No brand found");
		}

		await Vendor.destroy({
			where: {
				id: brandIds,
			},
		});
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

module.exports = {
	createVendor,
	getAllVendor,
	getVendorById,
	getVendorName,
	updateVendor,
	deleteVendor,
};
