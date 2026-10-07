/** @format */

const httpStatus = require("http-status");
const moment = require("moment");
const ApiError = require("../../utils/ApiError");
const { NumeralTaxCategory } = require("../../models");

const createTaxCategory = async (reqBody) => {
	try {
		const { numeral_tax_category } = reqBody;

		const name = numeral_tax_category
			.toLowerCase()
			.replace(/_/g, " ")
			.replace(/\b\w/g, (char) => char.toUpperCase());

		const categoryObj = {
			numeral_tax_category,
			name: name,
			created_at: moment(),
		};

		const categoryDoc = await NumeralTaxCategory.create(categoryObj);
		if (!categoryDoc) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to create new Tax Category"
			);
		}
		return categoryDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getTaxCategoryById = async (id) => {
	try {
		const brandDoc = await NumeralTaxCategory.findOne({
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

const getTaxCategoryName = async (reqBody) => {
	try {
		const productCategoryDoc = await NumeralTaxCategory.findAll({
			where: { is_active: true },
			attributes: ["id", "name", "numeral_tax_category"],
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

const updateTaxCategory = async (reqBody, id) => {
	try {
		const brandDoc = await NumeralTaxCategory.findByPk(id);

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

const deleteTaxCategory = async (body) => {
	try {
		if (!Array.isArray(body.type_id) || body.type_id.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid brand id");
		}

		// Ensure all IDs are trimmed and filtered
		const brandIds = body.type_id
			.map((id) => String(id).trim())
			.filter(Boolean);

		if (brandIds.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "No valid brand IDs provided");
		}

		// Find all blog categories with the given IDs
		const blogCategories = await NumeralTaxCategory.findAll({
			where: {
				id: brandIds,
			},
		});

		if (blogCategories.length === 0) {
			throw new ApiError(httpStatus.NOT_FOUND, "No brand found");
		}

		await NumeralTaxCategory.destroy({
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
	createTaxCategory,
	getTaxCategoryById,
	getTaxCategoryName,
	updateTaxCategory,
	deleteTaxCategory,
};
