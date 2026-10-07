/** @format */

const httpStatus = require("http-status");
const moment = require("moment");
const {
	ProductCategory,
	ProductCategoryMapping,
	ProductCategoryHeading,
} = require("../../models");
const ApiError = require("../../utils/ApiError");
const slugify = require("slugify");
const { literal } = require("sequelize");

const createProductCategoryHeading = async (reqBody) => {
	try {
		const existingCategory = await ProductCategoryHeading.findOne({
			where: { title: reqBody.title },
		});

		if (existingCategory) {
			throw new ApiError(
				httpStatus.CONFLICT, // 409 Conflict
				"This category already exists"
			);
		}

		const productCategoryObj = {
			title: reqBody.title,
			created_at: moment(),
		};

		const productCategoryDoc = await ProductCategoryHeading.create(
			productCategoryObj
		);
		if (!productCategoryDoc) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to create new Product Category"
			);
		}
		return productCategoryDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const createProductCategory = async (reqBody) => {
	try {
		const { category_id, title } = reqBody;
		const categoryObj = {
			title: title,
			category_id: category_id,
			created_at: moment(),
		};

		const categoryDoc = await ProductCategory.create(categoryObj);
		if (!categoryDoc) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to create new Category"
			);
		}
		return categoryDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllProductCategories = async (query) => {
	try {
		const { limit, sortBy, offset } = query;
		const productCategoryDoc = await ProductCategoryHeading.findAndCountAll({
			where: { is_active: true },
			limit: parseInt(limit),
			offset: parseInt(offset),
			order: [["id", sortBy]],
			attributes: {
				include: [
					[
						literal(`(
							SELECT COUNT(*)
							FROM product_categories AS pc
							WHERE pc.category_id = ProductCategoryHeading.id
							AND pc.is_active = true
						)`),
						"number_of_product_categories",
					],
				],
			},
		});
		if (!productCategoryDoc) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to get all Product Category"
			);
		}
		return productCategoryDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getProductCategory = async () => {
	try {
		const productCategoryDoc = await ProductCategoryHeading.findAll({
			attributes: ["id", "title"],
			include: [
				{
					model: ProductCategory,
					as: "product_categories_heading",
					attributes: ["id", "title", "category_id"],
				}
			]
		});

		// Filter out headings with no categories
		const filteredHeadings = productCategoryDoc.filter(
			(heading) => heading.product_categories_heading && heading.product_categories_heading.length > 0
		);

		return filteredHeadings.length > 0
			? filteredHeadings
			: "No Product Category Found";
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};


const getProductCategoryByCategoryId = async (body) => {
	try {
		const { category_id } = body;
		const serviceListDocs = await ProductCategory.findAll({
			attributes: ["id", "title", "category_id", "created_at"],
			where: { category_id: category_id, is_active: true },
		});
		if (!serviceListDocs)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get All Service List"
			);
		return serviceListDocs;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const findProductCategoryById = async (id) => {
	try {
		const productCategoryDoc = await ProductCategoryHeading.findOne({
			where: { id: id, is_active: true },
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

const getProductCategoryName = async () => {
	try {
		const productCategoryDoc = await ProductCategoryHeading.findAll({
			attributes: ["id", "title"],
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

const getAllProductCategoryName = async () => {
	try {
		const productCategoryDoc = await ProductCategory.findAll({
			attributes: ["id", "title"],
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

const updateProductCategoryHeading = async (reqBody, id) => {
	try {
		const productCategoryDoc = await ProductCategoryHeading.findByPk(id);
		if (!productCategoryDoc) {
			throw new ApiError(httpStatus.NOT_FOUND, "Product Category Id not found");
		}

		if (
			reqBody.title &&
			typeof reqBody.title !== "undefined" &&
			reqBody.title.trim() !== ""
		) {
			productCategoryDoc.title = reqBody.title;
			productCategoryDoc.slug = slugify(reqBody.title, { lower: true });
		}

		await productCategoryDoc.save();

		return productCategoryDoc ? productCategoryDoc : {};
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const updateProductCategory = async (reqBody, id) => {
	try {
		const productCategoryDoc = await ProductCategory.findByPk(id);
		if (!productCategoryDoc) {
			throw new ApiError(httpStatus.NOT_FOUND, "Product Category Id not found");
		}

		if (
			reqBody.title &&
			typeof reqBody.title !== "undefined" &&
			reqBody.title.trim() !== ""
		) {
			productCategoryDoc.title = reqBody.title;
			productCategoryDoc.slug = slugify(reqBody.title, { lower: true });
		}

		await productCategoryDoc.save();

		return productCategoryDoc ? productCategoryDoc : {};
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteProductCategoryHeading = async (body) => {
	try {
		if (!Array.isArray(body.category_id) || body.category_id.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid category Id");
		}

		// Ensure all IDs are trimmed and filtered
		const productCategoryIds = body.category_id
			.map((id) => String(id).trim())
			.filter(Boolean);

		if (productCategoryIds.length === 0) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"No valid category IDs provided"
			);
		}

		const productCategories = await ProductCategoryHeading.findAll({
			where: {
				id: productCategoryIds,
			},
		});

		if (productCategories.length === 0) {
			throw new ApiError(httpStatus.NOT_FOUND, "No categories found");
		}

		await ProductCategory.destroy({
			where: {
				category_id: productCategoryIds,
			},
		});

		// Remove associations
		await ProductCategoryMapping.destroy({
			where: {
				product_category_id: productCategoryIds,
			},
		});

		await ProductCategoryHeading.destroy({
			where: {
				id: productCategoryIds,
			},
		});
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteProductCategory = async (body) => {
	try {
		if (!Array.isArray(body.category_id) || body.category_id.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid category Id");
		}

		// Ensure all IDs are trimmed and filtered
		const productCategoryIds = body.category_id
			.map((id) => String(id).trim())
			.filter(Boolean);

		if (productCategoryIds.length === 0) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"No valid category IDs provided"
			);
		}

		const productCategories = await ProductCategory.findAll({
			where: {
				id: productCategoryIds,
			},
		});

		if (productCategories.length === 0) {
			throw new ApiError(httpStatus.NOT_FOUND, "No categories found");
		}


		await ProductCategory.destroy({
			where: {
				id: productCategoryIds,
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
	createProductCategoryHeading,
	createProductCategory,
	getAllProductCategories,
	getProductCategoryByCategoryId,
	getProductCategory,
	getAllProductCategoryName,
	findProductCategoryById,
	getProductCategoryName,
	updateProductCategoryHeading,
	updateProductCategory,
	deleteProductCategoryHeading,
	deleteProductCategory
};
