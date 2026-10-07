/** @format */

const httpStatus = require("http-status");
const { Sequelize, Op } = require("sequelize");
const moment = require("moment-timezone");
const path = require("path");
const fs = require("fs");
const {
	Blog,
	BlogAttachment,
	BlogCategory,
	BlogCategoryMapping,
} = require("../../models");
const ApiError = require("../../utils/ApiError");

const createBlog = async (body, files) => {
	try {
		const { title, description, blog_category_ids, user } = body;

		let blogObj = {
			created_by: user.id,
		};
		if (title && typeof title !== "undefined" && title !== "")
			blogObj["title"] = title;
		if (description && typeof description !== "undefined" && description !== "")
			blogObj["description"] = description;

		let blogDoc = await Blog.create(blogObj);
		if (!blogDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to create New Blog"
			);

		// Add blog category associations
		if (
			blog_category_ids &&
			Array.isArray(blog_category_ids) &&
			blog_category_ids.length > 0
		) {
			for (const categoryId of blog_category_ids) {
				const blogCategoryMapping = {
					blog_id: blogDoc.id,
					blog_category_id: categoryId,
				};
				await BlogCategoryMapping.create(blogCategoryMapping);
			}
		}

		if (
			files &&
			Object.keys(files).length !== 0 &&
			files.images &&
			files.images.length !== 0
		) {
			for (let i = 0; i < files.images.length; i++) {
				let currImage = files.images[i];
				const blogAttachmentObj = {
					blog_id: blogDoc.id,
					file_type: "Image",
					file_name: currImage.filename,
					file_uri: "/images",
					file_size: currImage.size,
				};
				await BlogAttachment.create(blogAttachmentObj);
			}
		}

		blogDoc = await Blog.findOne({
			where: { id: blogDoc.id, is_active: true },
			attributes: [
				"id",
				"title",
				"description",
				"created_at",
				[
					Sequelize.literal(
						"DATE_FORMAT(Blog.created_at, '%Y-%m-%d %H:%i %p')"
					),
					"formatted_created_at",
				],
				"updated_at",
			],
			include: [
				{
					model: BlogAttachment,
					as: "blog_attachments",
					attributes: ["id", "file_type", "file_name", "file_uri"],
				},
				{
					model: BlogCategory,
					as: "blog_categories",
					attributes: ["id", "title", "slug"],
					through: { attributes: [] },
				},
			],
		});

		if (!blogDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get All Post"
			);

		return blogDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllBlogByToken = async (body, query, params) => {
	try {
		const { user } = body;
		const { sortBy, limit, offset } = query;
		const {} = params;

		const blogDoc = await Blog.findAndCountAll({
			attributes: [
				"id",
				"title",
				"description",
				"is_active",
				"created_at",
				[
					Sequelize.literal("DATE_FORMAT(created_at, '%Y-%m-%d %H:%i %p')"),
					"formatted_created_at",
				],
				"updated_at",
			],
			where: { is_active: true },
			include: [
				{
					model: BlogAttachment,
					as: "blog_attachments",
					attributes: ["id", "file_type", "file_name", "file_uri"],
				},
				{
					model: BlogCategory,
					as: "blog_categories", // Using the updated many-to-many alias
					attributes: ["id", "title", "slug", "description"],
					through: { attributes: [] }, // Exclude fields from the join table
				},
			],
			limit: parseInt(limit),
			offset: parseInt(offset),
			order: [["created_at", `${sortBy}`]],
		});

		if (!blogDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get All Posts"
			);

		return blogDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const blogDetailById = async (body, params) => {
	try {
		const {} = body;
		const { blog_id } = params;

		if (!blog_id)
			throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Invalid blog id");

		const blogDoc = await Blog.findOne({
			attributes: [
				"id",
				"title",
				"description",
				[
					Sequelize.literal(
						"DATE_FORMAT(Blog.created_at, '%Y-%m-%d %H:%i %p')"
					),
					"formatted_created_at",
				],
				"updated_at",
			],
			where: { id: blog_id, is_active: true },
			include: [
				{
					model: BlogAttachment,
					as: "blog_attachments",
					attributes: ["id", "file_type", "file_name", "file_uri"],
				},
				{
					model: BlogCategory,
					as: "blog_categories",
					attributes: ["id", "title", "slug", "description"],
					through: { attributes: [] }, // No need for additional attributes from the junction table
				},
			],
		});

		if (!blogDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get Blog Post"
			);

		// Get the category IDs associated with the current blog
		const categoryIds = blogDoc.blog_categories.map((category) => category.id);

		// Fetch related blogs that belong to the same categories but exclude the current blog
		const relatedBlogs = await Blog.findAll({
			where: {
				is_active: true,
				id: { [Op.ne]: blog_id }, // Exclude current blog
			},
			attributes: [
				"id",
				"title",
				"description",
				[
					Sequelize.literal(
						"DATE_FORMAT(Blog.created_at, '%Y-%m-%d %H:%i %p')"
					),
					"formatted_created_at",
				],
				"updated_at",
			],
			include: [
				{
					model: BlogAttachment,
					as: "blog_attachments", // Fetch related blog attachments
					attributes: ["id", "file_type", "file_name", "file_uri"],
				},
				{
					model: BlogCategory,
					as: "blog_categories",
					attributes: ["id", "title"],
					where: { id: { [Op.in]: categoryIds } }, // Match with current blog's categories
					through: { attributes: [] },
				},
			],
			limit: 4,
		});

		if (relatedBlogs) {
			// Add related blogs to the current blog document
			blogDoc.dataValues.related_blogs = relatedBlogs;
		}

		return blogDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const updateBlog = async (body, files, id) => {
	try {
		const { title, description, blog_category_ids, user } = body;
		let result = "";

		// Find the blog by primary key
		let blogDoc = await Blog.findByPk(id);
		if (!blogDoc) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Blog Id");

		// Check if the blog fields have changed, and update them
		if (title && title !== blogDoc.title) blogDoc["title"] = title;
		if (description && description !== blogDoc["description"])
			blogDoc["description"] = description;

		// Save the updated blog document
		result = await blogDoc.save();

		// Update the Blog Category Mapping (Many-to-Many)
		// Get current associated categories
		const currentCategories = await blogDoc.getBlog_categories();
		const currentCategoryIds = currentCategories.map((cat) => cat.id);

		// Find categories to add and remove
		const newCategoryIds = Array.isArray(blog_category_ids)
			? blog_category_ids.map((id) => parseInt(id, 10))
			: [];

		// Categories to add: present in new list but not in the current list
		const categoriesToAdd = newCategoryIds.filter(
			(newId) => !currentCategoryIds.includes(newId)
		);

		// Categories to remove: present in current list but not in the new list
		const categoriesToRemove = currentCategoryIds.filter(
			(currentId) => !newCategoryIds.includes(currentId)
		);

		// Update category mapping
		if (categoriesToAdd.length > 0) {
			await blogDoc.addBlog_categories(categoriesToAdd); // Add new categories
		}
		if (categoriesToRemove.length > 0) {
			await blogDoc.removeBlog_categories(categoriesToRemove); // Remove old categories
		}

		// Handle file attachments if provided
		if (
			files &&
			Object.keys(files).length !== 0 &&
			files.images &&
			files.images.length !== 0
		) {
			// Fetch and remove old attachments
			const oldAttachments = await BlogAttachment.findAll({
				where: { blog_id: blogDoc.id, is_active: true },
			});
			for (const oldAttachment of oldAttachments) {
				const filePath = path.join(
					__dirname,
					"../../../public/uploads/images",
					oldAttachment.file_name
				);
				await oldAttachment.destroy({ force: true });
				fs.unlinkSync(filePath);
			}

			// Add new attachments
			for (let i = 0; i < files.images.length; i++) {
				let currImage = files.images[i];
				const blogAttachmentObj = {
					blog_id: blogDoc.id,
					file_type: "Image",
					file_name: currImage.filename,
					file_uri: "/images",
					file_size: currImage.size,
				};
				await BlogAttachment.create(blogAttachmentObj); // Create new attachment record
			}
		}

		return blogDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteBlog = async (body) => {
	try {
		// Validate blog_id
		if (!Array.isArray(body.blog_id) || body.blog_id.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid blog_id");
		}

		// Ensure all IDs are trimmed and filtered
		const blogIds = body.blog_id.map((id) => String(id).trim()).filter(Boolean);

		if (blogIds.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "No valid blog IDs provided");
		}

		// Find all blogs with the given IDs
		const blogs = await Blog.findAll({
			where: {
				id: blogIds,
			},
		});

		if (blogs.length === 0) {
			throw new ApiError(httpStatus.NOT_FOUND, "No blogs found");
		}

		// Find and delete associated blog attachments
		const blogAttachments = await BlogAttachment.findAll({
			where: {
				blog_id: blogIds,
			},
		});

		if (blogAttachments.length > 0) {
			await Promise.all(
				blogAttachments.map((attachment) => attachment.destroy())
			);
		}

		// Delete the associated categories from BlogCategoryMapping table
		await BlogCategoryMapping.destroy({
			where: {
				blog_id: blogIds,
			},
		});

		// Delete the blogs themselves
		await Promise.all(blogs.map((blog) => blog.destroy()));
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

module.exports = {
	createBlog,
	getAllBlogByToken,
	blogDetailById,
	updateBlog,
	deleteBlog,
};
