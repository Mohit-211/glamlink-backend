/** @format */

const httpStatus = require("http-status");
const { Sequelize, Op } = require("sequelize");
const moment = require("moment-timezone");

const {
	User,
	Service,
	ServiceAttachment,
	Booking,
	Category,
	BookingSlot,
	ServiceList,
	Profile,
} = require("../../models");
const ApiError = require("../../utils/ApiError");

const createService = async (body, files) => {
	const { name, description, category_id, price, duration, user } = body;

	let serviceObj = {
		user_id: user.id,
	};
	if (name && typeof name !== "undefined" && name !== "")
		serviceObj["name"] = name;
	if (description && typeof description !== "undefined" && description !== "")
		serviceObj["description"] = description;
	if (category_id && typeof category_id !== "undefined" && category_id !== "")
		serviceObj["category_id"] = category_id;
	if (price && typeof price !== "undefined" && price !== "")
		serviceObj["price"] = price;
	if (duration && typeof duration !== "undefined" && duration !== "")
		serviceObj["duration"] = duration;

	try {
		const serviceDoc = await Service.create(serviceObj);
		if (!serviceDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to create New Service"
			);

		if (
			files &&
			Object.keys(files).length !== 0 &&
			files.images &&
			files.images.length !== 0
		) {
			for (let i = 0; i < files.images.length; i++) {
				let currImage = files.images[i];
				const serviceAttachmentObj = {
					service_id: serviceDoc.id,
					file_type: "Image",
					file_name: currImage.filename,
					file_uri: "/images",
					file_size: currImage.size,
				};
				await ServiceAttachment.create(serviceAttachmentObj);
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
				const serviceAttachmentObj = {
					service_id: serviceDoc.id,
					file_type: "Video",
					file_name: currVideo.filename,
					file_uri: "/videos",
					file_size: currVideo.size,
				};
				await ServiceAttachment.create(serviceAttachmentObj);
			}
		}

		if (
			files &&
			Object.keys(files).length !== 0 &&
			files.docs &&
			files.docs.length !== 0
		) {
			for (let i = 0; i < files.docs.length; i++) {
				let currDoc = files.docs[i];
				const serviceAttachmentObj = {
					service_id: serviceDoc.id,
					file_type: "Video",
					file_name: currDoc.filename,
					file_uri: "/videos",
					file_size: currDoc.size,
				};
				await ServiceAttachment.create(serviceAttachmentObj);
			}
		}

		user.user_profile.no_of_service_provided =
			user.user_profile.no_of_service_provided + 1;
		await user.user_profile.save();

		return serviceDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllServiceByToken = async (body, query, params) => {
	try {
		const { user } = body;
		const { sortBy, limit, offset } = query;
		const {} = params;

		const serviceDoc = await Service.findAll({
			attributes: [
				"id",
				"name",
				"description",
				"category_id",
				"price",
				"duration",
				"created_at",
				[
					Sequelize.literal("DATE_FORMAT(created_at, '%Y-%m-%d %H:%i %p')"),
					"formatted_created_at",
				],
				"updated_at",
			],
			where: { user_id: user.id, is_active: true },
			include: [
				{
					model: ServiceAttachment,
					as: "attachements",
					attributes: ["id", "file_type", "file_name", "file_uri"],
				},
			],
			limit: parseInt(limit),
			offset: parseInt(offset),
			order: [["created_at", `${sortBy}`]],
		});
		if (!serviceDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get All Post"
			);
		return serviceDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllServiceByUserId = async (body, query, params) => {
	try {
		const { sortBy, limit, offset } = query;
		const { id } = params;
		const userDoc = await User.findByPk(id);
		if (!userDoc)
			throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Inavlid User Id");

		const serviceDoc = await Service.findAll({
			attributes: [
				"id",
				"name",
				"description",
				"category_id",
				"price",
				"duration",
				"created_at",
				[
					Sequelize.literal("DATE_FORMAT(created_at, '%Y-%m-%d %H:%i %p')"),
					"formatted_created_at",
				],
				"updated_at",
			],
			where: { user_id: id, is_active: true },
			include: [
				{
					model: ServiceAttachment,
					as: "attachements",
					attributes: ["id", "file_type", "file_name", "file_uri"],
				},
				{
					model: Category,
					as: "category",
					attributes: ["id", "title", "slug", "description"],
				},
			],
			limit: parseInt(limit),
			offset: parseInt(offset),
			order: [["created_at", `${sortBy}`]],
		});
		if (!serviceDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get All Post"
			);
		return serviceDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllServiceNameByUserId = async (id) => {
	try {
		const userDoc = await User.findByPk(id);
		if (!userDoc)
			throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Inavlid User Id");

		const serviceDoc = await Service.findAll({
			attributes: [
				"id",
				"name",
				"description",
				"category_id",
				"price",
				"duration",
			],
			where: { user_id: id, is_active: true },
		});
		if (!serviceDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get All Post"
			);
		return serviceDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const serviceDetailById = async (body, params) => {
	try {
		const {} = body;
		const { service_id } = params;

		const serviceDoc = await Service.findAll({
			attributes: [
				"id",
				"name",
				"description",
				"category_id",
				"price",
				"duration",
				"created_at",
				"updated_at",
			],
			where: { id: service_id, is_active: true },
			include: [
				{
					model: ServiceAttachment,
					as: "attachements",
					attributes: ["id", "file_type", "file_name", "file_uri"],
				},
				{
					model: Category,
					as: "category",
					attributes: ["id", "title", "slug", "description"],
				},
			],
		});
		if (!serviceDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get All Post"
			);
		return serviceDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const updateService = async (body, files) => {
	try {
		const {
			service_id,
			name,
			description,
			category_id,
			price,
			duration,
			user,
		} = body;
		let result = "";
		const serviceDoc = await Service.findByPk(service_id);
		if (!serviceDoc)
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Service Id");

		const categoryDoc = await Category.findOne({
			where: { id: category_id, is_active: true },
		});
		if (!categoryDoc)
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Category Id");

		if (serviceDoc.user_id !== user.id)
			throw new ApiError(
				httpStatus.UNAUTHORIZED,
				"You are not authorized to do this."
			);

		if (
			name &&
			typeof name !== "undefined" &&
			name !== "" &&
			name !== serviceDoc.name
		)
			serviceDoc["name"] = name;
		if (
			description &&
			typeof description !== "undefined" &&
			description !== "" &&
			serviceDoc["description"] !== description
		)
			serviceDoc["description"] = description;
		if (
			category_id &&
			typeof category_id !== "undefined" &&
			category_id !== "" &&
			serviceDoc["category_id"] !== category_id
		)
			serviceDoc["category_id"] = category_id;
		if (
			price &&
			typeof price !== "undefined" &&
			price !== "" &&
			serviceDoc["price"] !== price
		)
			serviceDoc["price"] = price;
		if (
			duration &&
			typeof duration !== "undefined" &&
			duration !== "" &&
			serviceDoc["duration"] !== duration
		)
			serviceDoc["duration"] = duration;

		result = await serviceDoc.save();
		if (
			files &&
			Object.keys(files).length !== 0 &&
			files.images &&
			files.images.length !== 0
		) {
			for (let i = 0; i < files.images.length; i++) {
				let currImage = files.images[i];
				const serviceAttachmentObj = {
					service_id: serviceDoc.id,
					file_type: "Image",
					file_name: currImage.filename,
					file_uri: "/images",
					file_size: currImage.size,
				};
				await ServiceAttachment.create(serviceAttachmentObj);
			}
		}
		("");
		if (
			files &&
			Object.keys(files).length !== 0 &&
			files.videos &&
			files.videos.length !== 0
		) {
			for (let i = 0; i < files.videos.length; i++) {
				let currVideo = files.videos[i];
				const serviceAttachmentObj = {
					service_id: serviceDoc.id,
					file_type: "Video",
					file_name: currVideo.filename,
					file_uri: "/videos",
					file_size: currVideo.size,
				};
				await ServiceAttachment.create(serviceAttachmentObj);
			}
		}

		if (
			files &&
			Object.keys(files).length !== 0 &&
			files.docs &&
			files.docs.length !== 0
		) {
			for (let i = 0; i < files.docs.length; i++) {
				let currDoc = files.docs[i];
				const serviceAttachmentObj = {
					service_id: serviceDoc.id,
					file_type: "Video",
					file_name: currDoc.filename,
					file_uri: "/videos",
					file_size: currDoc.size,
				};
				await ServiceAttachment.create(serviceAttachmentObj);
			}
		}
		return result;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteService = async (params) => {
	try {
		const { service_id } = params;
		const serviceDoc = await Service.findByPk(service_id);
		if (!serviceDoc)
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Service Id");
		const relatedBookingDocs = await Booking.findAll({
			where: { service_id: serviceDoc.id },
		});

		if (relatedBookingDocs.length > 0) {
			const relatedBookingIds = relatedBookingDocs.map((booking) => booking.id);
			await Promise.all([
				BookingSlot.destroy({
					where: { booking_id: { [Op.in]: relatedBookingIds } },
					force: true,
				}),
				Booking.destroy({
					where: { id: { [Op.in]: relatedBookingIds } },
					force: true,
				}),
			]);
		}
		await ServiceAttachment.destroy({
			where: { service_id: serviceDoc.id },
			force: true,
		});
		await serviceDoc.destroy({ force: true });
		return "";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const createBooking = async (body) => {
	const { service_id, description, booking_type, user } = body;
	const serviceDoc = await Service.findByPk(service_id);
	if (!serviceDoc)
		throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, "Inavlid Service Id");

	let bookingObj = {
		user_id: user.id,
		served_by: serviceDoc.user_id,
		service_id: serviceDoc.id,
		booking_type: booking_type ? booking_type : "Normal",
	};
	if (description && typeof description !== "undefined" && description !== "")
		bookingObj["description"] = description;

	try {
		const bookingDoc = await Booking.create(bookingObj);
		if (!bookingDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to create New Booking"
			);
		return true;
	} catch (error) {
		console.log(error);
		throw new ApiError(
			httpStatus.INTERNAL_SERVER_ERROR,
			"Failed to book this Service"
		);
	}
};

const getServiceListByCategory = async (body) => {
	try {
		const { category_id } = body;
		const serviceListDocs = await ServiceList.findAll({
			attributes: ["id", "title", "description", "category_id", "created_at"],
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

const getOtherServiceListByCategory = async (body) => {
	try {
		console.log(body, "body");
		const { category_id } = body;
		const serviceListDocs = await Service.findAll({
			where: { category_id: category_id, is_active: true },
			include: [
				{
					model: User,
					as: "service_user",
					attributes: ["id", "role_id"],
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: ["id", "name"],
						},
					],
				},
			],
		});
		if (!serviceListDocs)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Get All Service List"
			);
		return {
			data: serviceListDocs,
			number_of_service_list: serviceListDocs.length,
		};
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteServiceByAdmin = async (reqBody) => {
	try {
		const { service_id } = reqBody;
		const serviceDoc = await Service.findOne({ where: { id: service_id } });
		if (!serviceDoc)
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Service Id");
		const relatedBookingDocs = await Booking.findAll({
			where: { service_id: serviceDoc.id },
		});

		if (relatedBookingDocs.length > 0) {
			const relatedBookingIds = relatedBookingDocs.map((booking) => booking.id);
			await Promise.all([
				BookingSlot.destroy({
					where: { booking_id: { [Op.in]: relatedBookingIds } },
					force: true,
				}),
				Booking.destroy({
					where: { id: { [Op.in]: relatedBookingIds } },
					force: true,
				}),
			]);
		}
		await ServiceAttachment.destroy({
			where: { service_id: serviceDoc.id },
		});
		await serviceDoc.destroy({ force: true });
		return "";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

module.exports = {
	createService,
	getAllServiceByToken,
	getAllServiceByUserId,
	serviceDetailById,
	updateService,
	deleteService,
	createBooking,
	getServiceListByCategory,
	getOtherServiceListByCategory,
	deleteServiceByAdmin,
	getAllServiceNameByUserId
};
