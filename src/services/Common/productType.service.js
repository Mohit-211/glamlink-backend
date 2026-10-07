/** @format */

const httpStatus = require("http-status");
const moment = require("moment");

const ApiError = require("../../utils/ApiError");
const { ProductType } = require("../../models");

const createProductType = async (reqBody) => {
	try {
		const { user } = reqBody;
		const brandObj = {
			name: reqBody.name,
			user_id: user.id,
			created_at: moment(),
		};

		const brandDoc = await ProductType.create(brandObj);
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

const getAllProductType = async (reqBody) => {
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


	
		const brandDoc = await ProductType.findAll({
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

const getProductTypeById = async (id) => {
	try {
		const brandDoc = await ProductType.findOne({
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

const getProductTypeName = async (reqBody) => {
	try {
		const {user} = reqBody
		const productCategoryDoc = await ProductType.findAll({
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

const updateProductType = async (reqBody, id) => {
	try {
		const brandDoc = await ProductType.findByPk(id);

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

		await brandDoc.save();
		return brandDoc ? brandDoc : {};
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteProductType = async (body) => {
	try {
		if (!Array.isArray(body.type_id) || body.type_id.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid brand id");
		}

		// Ensure all IDs are trimmed and filtered
		const brandIds = body.type_id
			.map((id) => String(id).trim())
			.filter(Boolean);

		if (brandIds.length === 0) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"No valid brand IDs provided"
			);
		}

		// Find all blog categories with the given IDs
		const blogCategories = await ProductType.findAll({
			where: {
				id: brandIds,
			},
		});

		if (blogCategories.length === 0) {
			throw new ApiError(httpStatus.NOT_FOUND, "No brand found");
		}

		await ProductType.destroy({
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
	createProductType,
	getAllProductType,
	getProductTypeById,
	getProductTypeName,
	updateProductType,
	deleteProductType,
};
