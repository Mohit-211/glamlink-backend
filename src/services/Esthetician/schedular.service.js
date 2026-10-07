/** @format */

const httpStatus = require("http-status");
const moment = require("moment");

const {
	Availability,
	Booking,
} = require("../../models");
const ApiError = require("../../utils/ApiError");
const { Op } = require("sequelize");
const sequelize = require("../../config/central.db");

// New Code --------------------------------------------------------------------------------------------------
const createAvailability = async (body) => {
	try {
		const {
			user,
			timezone,
			slot_duration_in_minuites,
			start_time,
			end_time,
			day,
			maximum_available_seats,
			start_time_local,
			end_time_local,
		} = body;
		console.log(body, "body");
		// First Create/find the ruleset for counselor
		let availabilityObject = {
			counselor_id: user.id,
			day_name: day,
			start_time: start_time,
			end_time: end_time,
			time_zone: timezone,
			duration: slot_duration_in_minuites,
			maximum_available_seats: maximum_available_seats,
			is_active: true,
			created_at: moment(),
			start_time_local: start_time_local,
			end_time_local: end_time_local,
		};
		const existingSlots = await Availability.findAll({
			where: {
				counselor_id: user.id,
				day_name: day,
			},
		});

		if (isOverlapping(start_time, end_time, existingSlots)) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"This is an Overlaping duration of this day"
			);
		}

		const [availabilityDoc, isNewAvailabilityCreated] =
			await Availability.findOrCreate({
				where: {
					day_name: day,
					counselor_id: user.id,
					start_time: start_time,
					end_time: end_time,
					duration: slot_duration_in_minuites,
				},
				defaults: availabilityObject,
			});
		if (!availabilityDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to create Availability."
			);
		return "Availabiliy Created Successfully.";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getSchedulRuleAndIntervalByCounselorToken = async (body, header) => {
	try {
		const { user } = body;

		const availabilityDoc = await Availability.findAll({
			attributes: [
				"id",
				"counselor_id",
				"time_zone",
				"day_name",
				"start_time",
				"end_time",
				"start_time_local",
				"end_time_local",
				"maximum_available_seats",
				"duration",
			],
			where: { counselor_id: user.id, is_active: true },
			order: [
				[
					sequelize.literal(
						'FIELD(day_name, "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")'
					),
				],
			],
		});
		if (!availabilityDoc)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to fetch Availability"
			);
		return transformAvailabilityData(availabilityDoc);
		return availabilityDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const updateAvailability = async (body) => {
	const {
		user,
		start_time,
		end_time,
		maximum_available_seats,
		availabilityDoc,
		start_time_local,
		end_time_local,
	} = body;

	try {
		const existingSlots = await Availability.findAll({
			where: {
				counselor_id: user.id,
				day_name: availabilityDoc.day_name,
				id: { [Op.ne]: availabilityDoc.id },
			},
		});

		if (isOverlapping(start_time, end_time, existingSlots)) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"This is an Overlaping duration of this day"
			);
		}

		const updatedSlot = await availabilityDoc.update({
			start_time,
			end_time,
			maximum_available_seats,
			start_time_local,
			end_time_local,
		});
		if (!updatedSlot)
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Update Availability."
			);

		return "Successfully Updated";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const deleteAvailability = async (body) => {
	const { availabilityDoc } = body;

	try {
		await availabilityDoc.destroy({ force: true });

		return "Availability slot deleted successfully";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

const getAvailabilityByCounselorId = async (body, header, params) => {
	try {
		const { user, dates, counselor_id, counselorDoc } = body;
		let { timezone } = header;

		let response = {};
		for (let date of dates) {
			const dayOfWeek = new Date(date).toLocaleString("en-us", {
				weekday: "long",
			});

			let availabilityDocs = await Availability.findAll({
				where: { day_name: dayOfWeek, counselor_id: counselor_id },
				order: [["start_time", "ASC"]],
			});

			if (!availabilityDocs || availabilityDocs.length === 0) {
				response[date] = [];
				continue;
			}

			let slots = [];
			for (let availability of availabilityDocs) {
				let slotDivisions = generateTimeSlotsWithDuration(
					availability.start_time,
					availability.end_time,
					availability.duration
				);
				slotDivisions.map((elm) => {
					(elm.available_seats = availability.maximum_available_seats),
						(elm.date = date),
						(elm.availability_id = availability.id),
						slots.push(elm);
				});
			}
			let bookingDocs = await Booking.findAll({
				where: { date: date, counselor_id: counselor_id },
			});

			let finalSlots = updateAvailableSeats(slots, bookingDocs);
			response[date] = finalSlots ? finalSlots : [];
		}
		return response;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

function normalizeTime(timeStr) {
	// If time is like "11:00" → convert to "11:00:00"
	if (timeStr.length === 5) {
		return `${timeStr}:00`;
	}
	return timeStr;
}

function isOverlapping(startTime, endTime, existingSlots) {
	const newStart = new Date(`1970-01-01T${normalizeTime(startTime)}`).getTime();
	const newEnd = new Date(`1970-01-01T${normalizeTime(endTime)}`).getTime();

	return existingSlots.some((slot) => {
		const existingStart = new Date(
			`1970-01-01T${normalizeTime(slot.start_time)}`
		).getTime();
		const existingEnd = new Date(
			`1970-01-01T${normalizeTime(slot.end_time)}`
		).getTime();

		return newStart < existingEnd && newEnd > existingStart;
	});
}

function transformAvailabilityData(data) {
	const groupedData = data.reduce((acc, slot) => {
		const { day_name, counselor_id, time_zone } = slot;

		if (!acc[day_name]) {
			acc[day_name] = {
				counselor_id,
				time_zone,
				day_name,
				rule_intervals: [],
			};
		}

		acc[day_name].rule_intervals.push({
			id: slot.id,
			counselor_id: slot.counselor_id,
			time_zone: slot.time_zone,
			day_name: slot.day_name,
			start_time: slot.start_time,
			end_time: slot.end_time,
			start_time_local: slot.start_time_local,
			end_time_local: slot.end_time_local,
			maximum_available_seats: slot.maximum_available_seats,
			duration: slot.duration,
		});

		return acc;
	}, {});

	return Object.values(groupedData);
}

// Utility function to generate time slots in AM/PM format
function generateTimeSlotsWithDuration(startTime, endTime, duration) {
	const slots = [];
	let start = new Date(`1970-01-01T${startTime}`);
	const end = new Date(`1970-01-01T${endTime}`);

	while (start < end) {
		const endSlot = new Date(start.getTime() + duration * 60000);
		if (endSlot > end) break;

		slots.push({
			start_time: formatAMPM(start),
			end_time: formatAMPM(endSlot),
		});

		start = endSlot;
	}

	return slots;
}

// Helper function to format Date object to AM/PM format
function formatAMPM(date) {
	let hours = date.getHours();
	let minutes = date.getMinutes();
	const ampm = hours >= 12 ? "PM" : "AM";
	hours = hours % 12;
	hours = hours ? hours : 12; // the hour '0' should be '12'
	minutes = minutes < 10 ? "0" + minutes : minutes;
	return hours + ":" + minutes + " " + ampm;
}

const updateAvailableSeats = (slots, bookingDocs) => {
	const updatedSlots = JSON.parse(JSON.stringify(slots));

	for (let booking of bookingDocs) {
		const { start_time, end_time } = booking;

		for (let slot of updatedSlots) {
			const slotStartTime = `${convertTime(slot.start_time)}:00`;
			const slotEndTime = `${convertTime(slot.end_time)}:00`;
			const bookingStartTime = start_time;
			const bookingEndTime = end_time;

			if (slotStartTime == bookingStartTime && slotEndTime == bookingEndTime) {
				// Reduce available seat count by 1
				slot.available_seats--;

				// Ensure available seat count doesn't go negative
				if (slot.available_seats < 0) {
					slot.available_seats = 0;
				}

				// Include booking ID in slot data
				if (!slot.bookings) {
					slot.bookings = [];
				}
				slot.bookings.push({ booking_id: booking.id });
			}
		}
	}
	return updatedSlots;
};

function convertTime(time) {
	// Check if input is in 12-hour format (AM/PM) or 24-hour format (HH:mm)
	const is12HourFormat = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i.test(time);
	const is24HourFormat = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/i.test(time);

	if (!is12HourFormat && !is24HourFormat) {
		return "Invalid time format";
	}

	// Convert time from 12-hour format to 24-hour format
	if (is12HourFormat) {
		const [_, hoursPart, minutesPart, period] = time.match(
			/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i
		);
		const hours = parseInt(hoursPart, 10);
		const minutes = minutesPart ? parseInt(minutesPart, 10) : 0; // Default to 0 if minutes are not provided
		const isPM = period.toUpperCase() === "PM";

		if (hours < 1 || hours > 12 || minutes < 0 || minutes >= 60) {
			return "Invalid time format";
		}

		let hours24 = hours;
		if (hours24 === 12 && !isPM) {
			// Handle 12 AM case
			hours24 = 0;
		} else if (isPM && hours24 !== 12) {
			// Add 12 hours for PM times (except 12 PM)
			hours24 += 12;
		}

		return `${String(hours24).padStart(2, "0")}:${String(minutes).padStart(
			2,
			"0"
		)}`;
	}

	// Convert time from 24-hour format to 12-hour format
	if (is24HourFormat) {
		const [hours, minutes] = time.split(":");
		let hours12 = parseInt(hours, 10);
		const ampm = hours12 >= 12 ? "PM" : "AM";

		if (hours12 > 23 || parseInt(minutes, 10) >= 60) {
			return "Invalid time format";
		}

		if (hours12 === 0) {
			// Handle 00:00 (midnight) case
			hours12 = 12;
		} else if (hours12 > 12) {
			// Convert hours greater than 12 to 12-hour format
			hours12 -= 12;
		}

		return `${hours12}:${String(minutes).padStart(2, "0")} ${ampm}`;
	}
}
// -----------------------------------------------------------------------------------------------------------------

module.exports = {
	createAvailability,
	getSchedulRuleAndIntervalByCounselorToken,
	getAvailabilityByCounselorId,
	deleteAvailability,
	updateAvailability,
};
