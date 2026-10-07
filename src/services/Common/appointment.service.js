/** @format */

const httpStatus = require("http-status");
const moment = require("moment");
const momentTz = require("moment-timezone");

const {
	User,
	Case,
	Profile,
	UserAttachment,
	Service,
	ServiceAttachment,
	Category,
	Booking,
	BookingSlot,
	Customer,
	Availability,
} = require("../../models");
const ApiError = require("../../utils/ApiError");
const {
	appointmentTypes,
	notificationTypes,
	caseTypes,
} = require("../../config/types");
const config = require("../../config/config");
const { createNotification } = require("./notification.service");
const { Sequelize } = require("../../config/central.db");
const { sendAppointmentEmails } = require("./email.service");

const getAllAppointment = async (body, header, query) => {
	try {
		const { user } = body;
		const { timezone } = header;
		const { timeStatus } = query;

		let response = {
			completed: [],
			upcoming: [],
			canceled: [],
			pending: [],
			today: [],
		};

		let where = { is_active: true };
		if (timeStatus === appointmentTypes.PENDING) {
			where["status"] = appointmentTypes.PENDING;
		}

		if (
			timeStatus === appointmentTypes.TODAY ||
			timeStatus === appointmentTypes.UPCOMING
		) {
			where["status"] = appointmentTypes.ACCEPTED;
		}

		if (timeStatus === appointmentTypes.CANCELED) {
			where["status"] = appointmentTypes.CANCELED;
		}

		if (user.role_id === Number(config.CLLR_ROLE_ID)) {
			where["counselor_id"] = user.id;
		} else if (user.role_id === Number(config.USR_ROLE_ID)) {
			where["user_id"] = user.id;
		}

		let appointmentDocs = await Booking.findAll({
			where: where,
			attributes: [
				"id",
				"user_id",
				"counselor_id",
				"slot_id",
				"service_id",
				"case_id",
				"notes",
				"call_type",
				"duration",
				"total_amount",
				"is_active",
				"is_user_canceled",
				"is_counselor_canceled",
				"is_term_form_accepted_by_user",
				"status",
				"is_counselor_joined",
				"is_user_joined",
				"is_user_canceled",
				"is_counselor_canceled",
				"is_payment_done",
				"is_rescheduled_done",
				"is_refund_needed",
				"timing_status",
				"start_time",
				"end_time",
				"cancelation_reason",
			],
			include: [
				{
					model: User,
					as:
						user.role_id === Number(config.CLLR_ROLE_ID)
							? "appointment_user"
							: "appointment_counselor",
					attributes: ["id", "role_id"],
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: [
								"id",
								"name",
								"qualification",
								"language",
								"mobile",
								"is_active",
								"created_at",
								"about",
								"overall_ratings",
								"no_of_user_rated",
								"no_of_user_reviewed",
								"user_coin_balances",
							],
						},
						{
							model: UserAttachment,
							as: "user_attachments",
							attributes: [
								"id",
								"title",
								"file_type",
								"file_name",
								"file_uri",
								"role_id",
							],
							order: [["id", "desc"]],
							limit: 1,
							where: { title: "Profile Image" },
						},
					],
				},
				{
					model: BookingSlot,
					as: "appointment_slot",
					attributes: [
						"id",
						"counselor_id",
						"booking_id",
						"remaining_seats",
						"duration",
						"date",
						"start_time",
						"end_time",
						"time_zone",
						"is_available",
						"start_time_local",
						"end_time_local",
					],
				},
				{
					model: Service,
					as: "appointment_service",
					attributes: [
						"id",
						"name",
						"description",
						"category_id",
						"price",
						"duration",
					],
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
				},
			],
			order: [["id", "DESC"]],
		});

		if (!appointmentDocs)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to get appointment list."
			);

		// Converting the time and date to a specific timezone
		appointmentDocs = appointmentDocs.map((appointment) => {
			const appointmentTimezone = appointment.appointment_slot.time_zone;
			const slotStartTimeLocal = appointment.appointment_slot.start_time;
			const slotDateLocal = appointment.appointment_slot.date;

			const startTimeWithDate = momentTz
				.tz(
					`${slotDateLocal} ${slotStartTimeLocal}`,
					"YYYY-MM-DD HH:mm:ss",
					appointmentTimezone
				)
				.tz(timezone)
				.format("DD MMMM hh:mm:ss A");
			const currentTime = moment.tz(new Date(), timezone);
			const appointmentTime = moment
				.tz(
					`${slotDateLocal} ${slotStartTimeLocal}`,
					"YYYY-MM-DD HH:mm:ss",
					appointmentTimezone
				)
				.tz(timezone);

			// Determine if the appointment is upcoming or completed
			const isUpcoming = currentTime.isBefore(appointmentTime);
			const isCompleted = currentTime.isAfter(appointmentTime);
			const isTodayAndGreater =
				moment()
					.tz(timezone)
					.isSame(moment(`${appointmentTime}`).tz(timezone), "day") &&
				currentTime.isSameOrBefore(appointmentTime);

			if (appointment.status === appointmentTypes.CANCELED) {
				response["canceled"].push({
					...appointment.dataValues,
					start_time_with_date: startTimeWithDate,
					is_upcoming: isUpcoming,
					is_completed: isCompleted,
					is_today_and_greater: isTodayAndGreater,
				});
			} else if (
				appointment.status === appointmentTypes.PENDING &&
				isUpcoming
			) {
				response["pending"].push({
					...appointment.dataValues,
					start_time_with_date: startTimeWithDate,
					is_upcoming: isUpcoming,
					is_completed: isCompleted,
					is_today_and_greater: isTodayAndGreater,
				});
			} else if (timeStatus === appointmentTypes.TODAY && isTodayAndGreater) {
				response["today"].push({
					...appointment.dataValues,
					start_time_with_date: startTimeWithDate,
					is_upcoming: isUpcoming,
					is_completed: isCompleted,
					is_today_and_greater: isTodayAndGreater,
				});
			} else if (
				timeStatus === appointmentTypes.UPCOMING &&
				isUpcoming &&
				appointment.status === appointmentTypes.ACCEPTED
			) {
				response["upcoming"].push({
					...appointment.dataValues,
					start_time_with_date: startTimeWithDate,
					is_upcoming: isUpcoming,
					is_completed: isCompleted,
					is_today_and_greater: isTodayAndGreater,
				});
			} else if (
				timeStatus === appointmentTypes.COMPLETED &&
				isCompleted &&
				appointment.status === appointmentTypes.ACCEPTED
			) {
				response["completed"].push({
					...appointment.dataValues,
					start_time_with_date: startTimeWithDate,
					is_upcoming: isUpcoming,
					is_completed: isCompleted,
					is_today_and_greater: isTodayAndGreater,
				});
			}

			return {
				...appointment.dataValues,
				start_time_with_date: startTimeWithDate,
				is_upcoming: isUpcoming,
				is_completed: isCompleted,
				is_today_and_greater: isTodayAndGreater,
			};
		});

		// PENDING: PAYMENT NOT DONE OR PAYMENT DONE BUT COUNSELLOR NOT ACCEPT
		// TODAY: PAYMENT DONE AMD COUNSELLOR ACCEPT
		// UPCOMING: PAYMENT DONE COUNSELOR ACCEPT AND MEETING ON FUTURE TIME
		// CANCELED: WHICH IS CANCLED BY USER OR COUNSELOR
		// COMPLETED: PAYMENT DONE AND COUNSELOR ACCEPT AND MEETING DONE

		if (timeStatus === appointmentTypes.PENDING) {
			return response["pending"];
		} else if (timeStatus === appointmentTypes.TODAY) {
			return response["today"];
		} else if (timeStatus === appointmentTypes.CANCELED) {
			return response["canceled"];
		} else if (timeStatus === appointmentTypes.UPCOMING) {
			return response["upcoming"];
		} else if (timeStatus === appointmentTypes.COMPLETED) {
			return response["completed"];
		} else {
			return appointmentDocs;
		}
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const createAppointment = async (body, header) => {
	try {
		const {
			user,
			notes,
			counselor_id,
			start_time,
			end_time,
			service_id,
			date,
			availabilityDoc,
			start_time_local,
			end_time_local,
		} = body;

		const { timezone } = header;

		const counselorDoc = await User.findOne({
			where: {
				id: counselor_id,
				is_active: true,
				role_id: config.CLLR_ROLE_ID,
			},
			attributes: ["id"],
			include: [
				{
					model: Profile,
					as: "user_profile",
					attributes: [
						"id",
						"name",
						"dialing_code",
						"qualification",
						"language",
						"mobile",
						"is_active",
						"created_at",
						"about",
						"overall_ratings",
						"no_of_user_rated",
						"no_of_user_reviewed",
						"user_coin_balances",
					],
				},
			],
		});
		if (!counselorDoc)
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Counselor Id.");

		let serviceDoc = await Service.findOne({
			where: { id: service_id, user_id: counselorDoc.id },
		});
		if (!serviceDoc)
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Service Id.");

		let caseObj = {
			counselor_id: counselor_id,
			user_id: user.id,
		};
		const [caseDoc, created] = await Case.findOrCreate({
			where: {
				counselor_id: counselor_id,
				user_id: user.id,
				is_active: true,
				status: caseTypes.ACCEPTED,
			},
			defaults: caseObj,
		});
		if (!caseDoc)
			throw new ApiError(httpStatus.BAD_REQUEST, "Case Initialization failed.");

		// Ensure an entry in Customer table
		const [customerDoc] = await Customer.findOrCreate({
			where: { professional_id: counselor_id, user_id: user.id },
			defaults: {
				professional_id: counselor_id,
				user_id: user.id,
				source: "Online", // since via app/website
				status: "customer",
			},
		});

		let bookingObj = {
			start_time: start_time,
			counselor_id: counselor_id,
			date: date,
			end_time: end_time,
			case_id: caseDoc.id,
			user_id: user.id,
			service_id: serviceDoc.id,
			duration: availabilityDoc.duration,
		};
		if (notes && notes !== "" && notes !== "undefined")
			bookingObj["notes"] = notes;
		if (serviceDoc.price) bookingObj["total_amount"] = serviceDoc.price;

		let newBookingDoc = {};

		let bookingSlotDoc = await BookingSlot.findOne({
			where: {
				date: date,
				counselor_id: counselor_id,
				start_time: start_time,
				end_time: end_time,
			},
		});
		if (bookingSlotDoc) {
			let existingBokingIds = bookingSlotDoc.booking_id;
			if (bookingSlotDoc.remaining_seats > 0) {
				newBookingDoc = await Booking.create(bookingObj);
				if (!newBookingDoc)
					throw new ApiError(
						httpStatus.BAD_REQUEST,
						"Failed to create new booking."
					);
				existingBokingIds = existingBokingIds + "," + newBookingDoc.id;
				bookingSlotDoc.remaining_seats = bookingSlotDoc.remaining_seats - 1;
				bookingSlotDoc.booking_id = existingBokingIds;
				await bookingSlotDoc.save();
			} else {
				throw new ApiError(
					httpStatus.BAD_REQUEST,
					"No seat left for this slot"
				);
			}
		} else {
			if (availabilityDoc.maximum_available_seats > 0) {
				newBookingDoc = await Booking.create(bookingObj);
				if (!newBookingDoc)
					throw new ApiError(
						httpStatus.BAD_REQUEST,
						"Failed to create new booking."
					);
				bookingSlotDoc = await BookingSlot.create({
					date: date,
					counselor_id: counselor_id,
					start_time: start_time,
					end_time: end_time,
					start_time_local: start_time_local,
					end_time_local: end_time_local,
					booking_id: newBookingDoc.id,
					remaining_seats: availabilityDoc.maximum_available_seats - 1,
					duration: availabilityDoc.duration,
					time_zone: timezone,
				});
			} else {
				throw new ApiError(
					httpStatus.BAD_REQUEST,
					"No seat left for this slot"
				);
			}
		}
		newBookingDoc.slot_id = bookingSlotDoc.id;
		await newBookingDoc.save();

		await sendAppointmentEmails(newBookingDoc, timezone);

		try {
			await createNotification({
				sender_id: user.id,
				receiver_id: counselor_id,
				timezone: timezone,
				type: notificationTypes.appointmentRequest,
			});
		} catch (error) {
			console.log("Error Sending Notification for creating booking : ", error);
		}

		return "";
	} catch (error) {
		console.log(error);
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const cancleAppointment = async (body, param) => {
	try {
		const { user, reason } = body;
		const { appointmentId } = param;
		let where = { is_active: true, id: appointmentId };
		if (user.role_id === Number(config.CLLR_ROLE_ID)) {
			where["counselor_id"] = user.id;
		} else if (user.role_id === Number(config.USR_ROLE_ID)) {
			where["user_id"] = user.id;
		}

		const appointmentDoc = await Booking.findOne({
			where: where,
			attributes: [
				"id",
				"user_id",
				"counselor_id",
				"slot_id",
				"service_id",
				"case_id",
				"notes",
				"call_type",
				"duration",
				"total_amount",
				"is_active",
				"is_user_canceled",
				"is_counselor_canceled",
				"is_term_form_accepted_by_user",
				"status",
				"is_counselor_joined",
				"is_user_joined",
				"is_user_canceled",
				"is_counselor_canceled",
				"is_payment_done",
				"is_rescheduled_done",
				"is_refund_needed",
				"timing_status",
				"start_time",
				"end_time",
			],
		});
		if (!appointmentDoc)
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Appointment Id.");

		if (appointmentDoc.status !== appointmentTypes.PENDING) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Appointment Status is not PENDING"
			);
		}

		appointmentDoc.status = appointmentTypes.CANCELED;
		appointmentDoc.is_user_canceled =
			user.role_id === Number(config.USR_ROLE_ID) ? true : false;
		appointmentDoc.is_counselor_canceled =
			user.role_id === Number(config.CLLR_ROLE_ID) ? true : false;
		appointmentDoc.cancelation_reason = reason ? reason : null;
		appointmentDoc.save();

		const slotDoc = await BookingSlot.findOne({
			where: { id: appointmentDoc.slot_id },
		});
		if (!slotDoc)
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Slot Id.");

		slotDoc.remaining_seats = slotDoc.remaining_seats + 1;
		let bookingIds = slotDoc.booking_id.split(",");
		const filteredArray = bookingIds.filter(
			(item) => item !== appointmentDoc.id
		);
		const newString = filteredArray.join(",");
		slotDoc.booking_id = newString;
		await slotDoc.save();

		try {
			await createNotification({
				sender_id: user.id,
				receiver_id:
					user.role_id === Number(config.CLLR_ROLE_ID)
						? appointmentDoc.user_id
						: appointmentDoc.counselor_id,
				type: notificationTypes.appointmentCanceled,
			});
		} catch (error) {
			console.log("Error Sending Notification for cancel booking : ", error);
		}

		return "";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const appointmentDetail = async (body, header, param) => {
	try {
		const { user } = body;
		const { timezone } = header;
		const { appointmentId } = param;

		let where = { is_active: true, id: appointmentId };

		if (user.role_id === Number(config.CLLR_ROLE_ID)) {
			where["counselor_id"] = user.id;
		} else if (user.role_id === Number(config.USR_ROLE_ID)) {
			where["user_id"] = user.id;
		}

		const appointmentDoc = await Booking.findOne({
			where: where,
			attributes: [
				"id",
				"user_id",
				"counselor_id",
				"slot_id",
				"service_id",
				"case_id",
				"notes",
				"call_type",
				"duration",
				"total_amount",
				"is_active",
				"is_user_canceled",
				"is_counselor_canceled",
				"is_term_form_accepted_by_user",
				"status",
				"is_counselor_joined",
				"is_user_joined",
				"is_user_canceled",
				"is_counselor_canceled",
				"is_payment_done",
				"is_rescheduled_done",
				"is_refund_needed",
				"timing_status",
				"start_time",
				"end_time",
			],
			include: [
				{
					model: User,
					as:
						user.role_id === Number(config.CLLR_ROLE_ID)
							? "appointment_user"
							: "appointment_counselor",
					attributes: ["id", "role_id"],
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: [
								"id",
								"name",
								"qualification",
								"language",
								"mobile",
								"is_active",
								"created_at",
								"about",
								"overall_ratings",
								"no_of_user_rated",
								"no_of_user_reviewed",
								"user_coin_balances",
							],
						},
						{
							model: UserAttachment,
							as: "user_attachments",
							attributes: [
								"id",
								"title",
								"file_type",
								"file_name",
								"file_uri",
								"role_id",
							],
							order: [["id", "desc"]],
							limit: 1,
							where: { title: "Profile Image" },
						},
					],
				},
				{
					model: BookingSlot,
					as: "appointment_slot",
					attributes: [
						"id",
						"counselor_id",
						"booking_id",
						"remaining_seats",
						"duration",
						"date",
						"start_time",
						"end_time",
						"time_zone",
						"is_available",
						"start_time_local",
						"end_time_local",
					],
				},
				{
					model: Service,
					as: "appointment_service",
					attributes: [
						"id",
						"name",
						"description",
						"category_id",
						"price",
						"duration",
					],
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
				},
			],
		});
		if (!appointmentDoc)
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Appointment Id.");
		const appointmentTimezone = appointmentDoc.appointment_slot.time_zone;
		const slotStartTimeLocal =
			appointmentDoc.appointment_slot.slot_start_time_local;
		const slotDateLocal = appointmentDoc.appointment_slot.slot_date_local;

		const startTimeWithDate = momentTz
			.tz(
				`${slotDateLocal} ${slotStartTimeLocal}`,
				"YYYY-MM-DD HH:mm:ss",
				appointmentTimezone
			)
			.tz(timezone)
			.format("DD MMMM hh:mm:ss A");
		const currentTime = moment.tz(new Date(), timezone);
		const appointmentDocTime = moment
			.tz(
				`${slotDateLocal} ${slotStartTimeLocal}`,
				"YYYY-MM-DD HH:mm:ss",
				appointmentTimezone
			)
			.tz(timezone);

		// Determine if the appointmentDoc is upcoming or completed
		const isUpcoming = currentTime.isBefore(appointmentDocTime);
		const isCompleted = currentTime.isAfter(appointmentDocTime);
		const isTodayAndGreater =
			moment()
				.tz(timezone)
				.isSame(moment(`${appointmentDocTime}`).tz(timezone), "day") &&
			currentTime.isSameOrBefore(appointmentDocTime);

		return {
			...appointmentDoc.dataValues,
			start_time_with_date: startTimeWithDate,
			is_upcoming: isUpcoming,
			is_completed: isCompleted,
			is_today_and_greater: isTodayAndGreater,
		};
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const acceptAppointment = async (body, header) => {
	try {
		const { user, appointment_id } = body;

		const { timezone } = header;
		if (user.role_id !== Number(config.CLLR_ROLE_ID))
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Only Counselor can access this api."
			);

		const appointmentDoc = await Booking.findOne({
			where: { id: appointment_id, counselor_id: user.id },
			attributes: [
				"id",
				"user_id",
				"counselor_id",
				"slot_id",
				"service_id",
				"case_id",
				"notes",
				"call_type",
				"duration",
				"total_amount",
				"is_active",
				"is_user_canceled",
				"is_counselor_canceled",
				"is_term_form_accepted_by_user",
				"status",
				"is_counselor_joined",
				"is_user_joined",
				"is_user_canceled",
				"is_counselor_canceled",
				"is_payment_done",
				"is_rescheduled_done",
				"is_refund_needed",
				"timing_status",
				"start_time",
				"end_time",
			],
		});
		if (!appointmentDoc)
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Appointment Id.");

		if (appointmentDoc.status !== appointmentTypes.PENDING) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Appointment Status is not PENDING"
			);
		}

		appointmentDoc.status = appointmentTypes.ACCEPTED;
		appointmentDoc.save();

		user.user_profile.total_bookings++;
		user.user_profile.save();

		try {
			await createNotification({
				sender_id: user.id,
				receiver_id: appointmentDoc.user_id,
				timezone: timezone,
				type: notificationTypes.appointmentBooked,
			});
		} catch (error) {
			console.log("Error Sending Notification for accepting booking : ", error);
		}
		return appointmentDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAllAppointmentForProfessional = async (body) => {
	try {
		const { user, type, year, month } = body;

		let whereCondition = { is_active: true, counselor_id: user.id };

		if (type === "year" && year) {
			whereCondition[Sequelize.Op.and] = [
				Sequelize.where(
					Sequelize.fn("YEAR", Sequelize.col("appointment_slot.date")),
					year
				),
			];
		} else if (type === "month" && year && month) {
			whereCondition[Sequelize.Op.and] = [
				Sequelize.where(
					Sequelize.fn("YEAR", Sequelize.col("appointment_slot.date")),
					year
				),
				Sequelize.where(
					Sequelize.fn("MONTH", Sequelize.col("appointment_slot.date")),
					month
				),
			];
		}

		let appointmentDocs = await Booking.findAll({
			where: whereCondition,
			attributes: [
				"id",
				"user_id",
				"counselor_id",
				"slot_id",
				"service_id",
				"case_id",
				"notes",
				"call_type",
				"duration",
				"total_amount",
				"is_active",
				"status",
				"start_time",
				"end_time",
				"is_payment_done",
			],
			include: [
				{
					model: User,
					as: "appointment_user",
					attributes: ["id", "role_id"],
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: [
								"id",
								"name",
								"qualification",
								"language",
								"mobile",
								"is_active",
								"created_at",
								"about",
								"overall_ratings",
								"no_of_user_rated",
								"no_of_user_reviewed",
								"user_coin_balances",
							],
						},
					],
						required: false,
				},
				// ✅ Fallback: If no user found, include customer info
				{
					model: Customer,
					as: "appointment_customer",
					attributes: ["id", "name", "email", "phone"],
					required: false, // ✅ Optional join
				},
				{
					model: BookingSlot,
					as: "appointment_slot",
					attributes: [
						"id",
						"counselor_id",
						"date",
						"start_time",
						"end_time",
						"time_zone",
					],
				},
				{
					model: Service,
					as: "appointment_service",
					attributes: ["id", "name", "description", "price", "duration"],
				},
			],
			order: [["id", "DESC"]],
		});

		if (!appointmentDocs)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to get appointment list."
			);

		return appointmentDocs;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const createAppointmentForEmployee = async (body, header) => {
	try {
		const {
			user,
			employee_id,
			service_id,
			start_time,
			end_time,
			date,
			availability_id,
			notes,
		} = body;

		const { timezone } = header;

		// 1️⃣ Validate employee under this beautician

		// 2️⃣ Validate service belongs to beautician or employee
		const serviceDoc = await Service.findOne({
			where: {
				id: service_id,
				user_id: user.id,
			},
		});
		console.log(serviceDoc,"serviceDoc")
		if (!serviceDoc)
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Service Id.");

		// 3️⃣ Fetch Availability
		const availabilityDoc = await Availability.findOne({
			where: { id: availability_id, counselor_id: user.id },
		});
		console.log(availabilityDoc,"availabilityDoc")
		if (!availabilityDoc)
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Availability Id.");

		// 3️⃣ Ensure Case exists between customer and beautician
		const [caseDoc] = await Case.findOrCreate({
			where: {
				counselor_id: user.id,
				user_id: employee_id,
				is_active: true,
				status: caseTypes.ACCEPTED,
			},
			defaults: {
				counselor_id: user.id,
				user_id: employee_id,
			},
		});


		// 5️⃣ Create Booking
		const bookingObj = {
			start_time,
			end_time,
			date,
			case_id: caseDoc.id,
			user_id: employee_id,
			service_id: serviceDoc.id,
			duration: availabilityDoc.duration,
			counselor_id: user.id,
			total_amount: serviceDoc.price || 0,
			status:"ACCEPTED"
		};
		if (notes) bookingObj.notes = notes;

		let newBookingDoc;
		let bookingSlotDoc = await BookingSlot.findOne({
			where: {
				date,
				counselor_id: user.id,
				start_time,
				end_time,
			},
		});

		// 6️⃣ Handle Slot Availability
		if (bookingSlotDoc) {
			if (bookingSlotDoc.remaining_seats > 0) {
				newBookingDoc = await Booking.create(bookingObj);
				bookingSlotDoc.remaining_seats -= 1;
				bookingSlotDoc.booking_id += `,${newBookingDoc.id}`;
				await bookingSlotDoc.save();
			} else {
				throw new ApiError(
					httpStatus.BAD_REQUEST,
					"No seat left for this slot."
				);
			}
		} else {
			if (availabilityDoc.maximum_available_seats > 0) {
				newBookingDoc = await Booking.create(bookingObj);
				bookingSlotDoc = await BookingSlot.create({
					date: date,
					counselor_id: user.id,
					start_time: start_time,
					end_time: end_time,
					start_time_local: availabilityDoc.start_time_local,
					end_time_local: availabilityDoc.end_time_local,
					booking_id: newBookingDoc.id,
					remaining_seats: availabilityDoc.maximum_available_seats - 1,
					duration: availabilityDoc.duration,
					time_zone: timezone,
				});
			} else {
				throw new ApiError(
					httpStatus.BAD_REQUEST,
					"No seat left for this slot."
				);
			}
		}

		newBookingDoc.slot_id = bookingSlotDoc.id;
		await newBookingDoc.save();

		// 7️⃣ Send Notification & Emails
		await sendAppointmentEmails(newBookingDoc, timezone);

		return {
			success: true,
			message: "Appointment booked successfully for employee.",
			data: newBookingDoc,
		};
	} catch (error) {
		console.error(error);
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteAppointment = async (body) => {
	try {
		const { booking_id } = body;

		// 1️⃣ Validate booking
		const bookingDoc = await Booking.findOne({
			where: { id: booking_id },
		});

		if (!bookingDoc)
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Booking ID.");

		// 2️⃣ Get slot document
		const slotDoc = await BookingSlot.findOne({
			where: { id: bookingDoc.slot_id },
		});

		// 3️⃣ Delete booking
		await Booking.destroy({ where: { id: booking_id } });

		// 4️⃣ If slot exists, adjust seat count and booking references
		if (slotDoc) {
			let updatedRemainingSeats = slotDoc.remaining_seats + 1;

			// Make sure not exceeding the original maximum seats if you track that
			if (
				slotDoc.maximum_available_seats &&
				updatedRemainingSeats > slotDoc.maximum_available_seats
			) {
				updatedRemainingSeats = slotDoc.maximum_available_seats;
			}

			// Remove the booking id from the comma-separated list (if stored like "1,2,3")
			let bookingIds = slotDoc.booking_id
				? slotDoc.booking_id.split(",").filter((id) => id && id != booking_id)
				: [];

			slotDoc.booking_id = bookingIds.join(",");
			slotDoc.remaining_seats = updatedRemainingSeats;
			await slotDoc.save();
		}

		// 5️⃣ (Optional) send email or notification

		return {
			success: true,
			message: "Appointment deleted successfully.",
		};
	} catch (error) {
		console.log("❌ Error deleting appointment:", error);
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message || "Failed to delete appointment."
		);
	}
};


module.exports = {
	getAllAppointment,
	createAppointment,
	cancleAppointment,
	appointmentDetail,
	acceptAppointment,
	getAllAppointmentForProfessional,
	createAppointmentForEmployee,
	deleteAppointment
};
