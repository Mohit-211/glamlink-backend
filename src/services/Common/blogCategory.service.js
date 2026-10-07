/** @format */

const httpStatus = require("http-status");
const moment = require("moment");
const { BlogCategory, Blog, BlogCategoryMapping } = require("../../models");
const ApiError = require("../../utils/ApiError");

const createBlogCategory = async (reqBody) => {
	try {
		const blogCategoryObj = {
			title: reqBody.title,
			// description: reqBody.description,
			created_at: moment(),
		};

		const blogCategoryDoc = await BlogCategory.create(blogCategoryObj);
		if (!blogCategoryDoc) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to create new BlogCategory"
			);
		}
		return blogCategoryDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllBlogCategories = async (query) => {
	try {
		const { limit, sortBy, offset } = query;
		const blogCategoryDoc = await BlogCategory.findAndCountAll({
			where: { is_active: true },
			limit: parseInt(limit),
			offset: parseInt(offset),
			order: [["id", sortBy]],
		});
		if (!blogCategoryDoc) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to get all BlogCategory"
			);
		}
		return blogCategoryDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const findBlogCategoryById = async (id) => {
	try {
		const blogCategoryDoc = await BlogCategory.findOne({
			where: { id: id, is_active: true },
		});
		return blogCategoryDoc ? blogCategoryDoc : "No BlogCategory Found";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getBlogCategoryName = async () => {
	try {
		const blogCategoryDoc = await BlogCategory.findAll({
			attributes: ["id", "title"],
		});
		return blogCategoryDoc ? blogCategoryDoc : "No BlogCategory Found";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const updateBlogCategory = async (reqBody, id) => {
	try {
		const blogCategoryDoc = await BlogCategory.findByPk(id);

		if (!blogCategoryDoc) {
			throw new ApiError(httpStatus.NOT_FOUND, "BlogCategory not found");
		}
		if (
			reqBody.title &&
			typeof reqBody.title !== "undefined" &&
			reqBody.title !== ""
		) {
			blogCategoryDoc["title"] = reqBody.title;
		}
		if (
			reqBody.description &&
			typeof reqBody.description !== "undefined" &&
			reqBody.description !== ""
		) {
			blogCategoryDoc["description"] = reqBody.description;
		}

		await blogCategoryDoc.save();
		return blogCategoryDoc ? blogCategoryDoc : {};
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteBlogCategory = async (body) => {
	try {
		// Validate blog_category_id
		if (!Array.isArray(body.blog_id) || body.blog_id.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid blog_id");
		}

		// Ensure all IDs are trimmed and filtered
		const blogCategoryIds = body.blog_id.map((id) => String(id).trim()).filter(Boolean);

		if (blogCategoryIds.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "No valid blog category IDs provided");
		}

		// Find all blog categories with the given IDs
		const blogCategories = await BlogCategory.findAll({
			where: {
				id: blogCategoryIds,
			},
		});

		if (blogCategories.length === 0) {
			throw new ApiError(httpStatus.NOT_FOUND, "No blog categories found");
		}

		// Remove associations between blogs and the deleted categories
		await BlogCategoryMapping.destroy({
			where: {
				blog_category_id: blogCategoryIds,
			},
		});

		// Delete the blog categories themselves
		await BlogCategory.destroy({
			where: {
				id: blogCategoryIds,
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
	findBlogCategoryById,
	createBlogCategory,
	getAllBlogCategories,
	getBlogCategoryName,
	updateBlogCategory,
	deleteBlogCategory,
};
