/** @format */

const httpStatus = require("http-status");
const ApiError = require("../../utils/ApiError");
const { BannerMedia, User, Profile } = require("../../models");
const config = require("../../config/config");

const createBanner = async (body, files) => {
	try {
		const { user } = body;

		if (user.role_id === Number(config.USR_ROLE_ID))
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"User can not access this api."
			);

		if (
			files &&
			Object.keys(files).length !== 0 &&
			files.images &&
			files.images.length !== 0
		) {
			for (let i = 0; i < files.images.length; i++) {
				let currImage = files.images[i];
				const bannerAttachmentObj = {
					user_id: user.id,
					role_id: user.role_id,
					title: " Banner Image",
					file_type: "Image",
					file_name: currImage.filename,
					file_uri: "/images",
					file_size: currImage.size,
				};
				await BannerMedia.create(bannerAttachmentObj);
			}
		}

		if (
			files &&
			Object.keys(files).length !== 0 &&
			files.videos &&
			files.videos.length !== 0
		) {
			for (let i = 0; i < files.videos.length; i++) {
				let currVideo = files.videos[i];
				const bannerAttachmentObj = {
					user_id: user.id,
					role_id: user.role_id,
					title: " Banner Video",
					file_type: "Video",
					file_name: currVideo.filename,
					file_uri: "/videos",
					file_size: currVideo.size,
				};
				await BannerMedia.create(bannerAttachmentObj);
			}
		}
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllBanner = async () => {
	try {
		const productDoc = await BannerMedia.findAll({
			where: { is_active: true },
			order: [["id", `ASC`]],
			attributes: [
				"id",
				"user_id",
				"title",
				"file_type",
				"file_name",
				"file_uri",
				"file_size",
				"created_at"
			],
			include: [
				{
					model: User,
					as: "banner_user",
					attributes: ["id", "role_id"],
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: [
								"id",
								"name",

							],
						},
					]
				}
			]
		});

		if (!productDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get All Products"
			);

		return productDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const findBannerById = async (id) => {
	try {
		const productDoc = await BannerMedia.findOne({
			where: { id: id, is_active: true },
		});

		if (!productDoc) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get Product"
			);
		}

		return productDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const updateBanner = async (reqBody, files, id) => {
	try {
		const { user } = reqBody
		// Find and delete the existing banner by ID
		const existingBanner = await BannerMedia.findByPk(id);
		if (!existingBanner)
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Banner ID");

		await existingBanner.destroy(); // Delete the existing banner

		// Add new image attachments
		if (files?.images?.length) {
			for (const image of files.images) {
				const newImage = {
					user_id: user.id,
					role_id: user.role_id,
					title: "Banner Image",
					file_type: "Image",
					file_name: image.filename,
					file_uri: "/images",
					file_size: image.size,
				};
				await BannerMedia.create(newImage);
			}
		}

		// Add new video attachments
		if (files?.videos?.length) {
			for (const video of files.videos) {
				const newVideo = {
					user_id: user.id,
					role_id: user.role_id,
					title: "Banner Video",
					file_type: "Video",
					file_name: video.filename,
					file_uri: "/videos",
					file_size: video.size,
				};
				await BannerMedia.create(newVideo);
			}
		}

		return { message: "Banner updated successfully" };
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteBanner = async (body) => {
	try {
		if (!Array.isArray(body.banner_id) || body.banner_id.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Product Id");
		}

		// Ensure all IDs are trimmed and filtered
		const blogIds = body.banner_id
			.map((id) => String(id).trim())
			.filter(Boolean);

		if (blogIds.length === 0) {
			throw new ApiError(httpStatus.BAD_REQUEST, "No valid blog IDs provided");
		}

		// Find all blogs with the given IDs
		const blogs = await BannerMedia.findAll({
			where: {
				id: blogIds,
			},
		});

		if (blogs.length === 0) {
			throw new ApiError(httpStatus.NOT_FOUND, "No products found");
		}

		// Delete the blogs themselves
		await Promise.all(blogs.map((blog) => blog.destroy()));
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllBannerByProfessional = async (reqBody) => {
	try {
		const { user } = reqBody;


		// if (!user.is_promoted) {
		// 	throw new ApiError(
		// 		httpStatus.FORBIDDEN,
		// 		"To access this feature, please buy a promotion using your available credit."
		// 	);
		// }

		// if (!user.is_promoted && !user.request_for_promotion) {
		// 	throw new ApiError(
		// 		httpStatus.FORBIDDEN,
		// 		"Only promoted beauticians can access this API."
		// 	);
		// }

		const productDoc = await BannerMedia.findAll({
			where: { is_active: true, user_id: user.id },
			order: [["id", `ASC`]],
		});

		if (!productDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get All Products"
			);

		return productDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

module.exports = {
	createBanner,
	getAllBanner,
	findBannerById,
	updateBanner,
	deleteBanner,
	getAllBannerByProfessional,
};
