/** @format */

const httpStatus = require("http-status");
const path = require("path");
const fs = require("fs");
const moment = require("moment");
const { DateTime } = require("luxon");

const {
	User,
	UserAttachment,
	Profile,
	Role,
	User_Speciality,
	Speciality,
	Slot,
	Case,
	Appointment,
	CaseAttachment,
	RuleInterval,
	ScheduleRule,
	Availability,
	Booking,
} = require("../../models");
const ApiError = require("../../utils/ApiError");
const {
	calculateDuration,
	isSameTimeOverlap,
	isSameDayOverlap,
	getDayInfo,
	generateTimeSlots,
	calculateTimeOffset,
	getTimeDifference,
	getDatesForWeekCount,
	getCurrentDayDetails,
	getAllFutureDatesForDayInCurrentMonth,
} = require("./helper");
const { Op } = require("sequelize");
const sequelize = require("../../config/central.db");
const config = require("../../config/config");

// const createAvailability = async (body) => {

//     try {
//         const { user, timezone, slot_duration_in_minuites, start_time, end_time, day, type, no_of_months, maximum_available_seats } = body;

//         // Find all the same day name dates available in the current month
//         let contigiousDates = getAllFutureDatesForDayInCurrentMonth(day);

//         // Calculate the provided start and end time is not less than the single slot division.
//         let duration = calculateDuration(start_time, end_time);
//         if (duration < slot_duration_in_minuites) throw new ApiError(httpStatus.BAD_REQUEST, 'Please select a valid start and end time');

//         // First Create/find the ruleset for counselor
//         let rulesObject = {
//             counselor_id: user.id,
//             type: type,
//             day_name_local: day.toLowerCase(),
//             time_zone: timezone,
//             is_active: true,
//             created_at: moment()
//         };

//         const [ruleDoc, isNewRuleCreated] = await ScheduleRule.findOrCreate({
//             where: { type: type, day_name_local: day.toLowerCase(), counselor_id: user.id },
//             defaults: rulesObject
//         });
//         if (!ruleDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create rules.');

//         for (let i = 0; i < contigiousDates.length; i++) {
//             let currDate = contigiousDates[i];

//             // Checking start time and end time and also create the information like dayName, dayNumber, monthNumber, monthName....
//             let startTimeInfo = getDayInfo(`${currDate}T${start_time}`, timezone);
//             let endTimeInfo = getDayInfo(`${currDate}T${end_time}`, timezone);
//             if (!startTimeInfo || !endTimeInfo) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Internal Server Error.');

//             // Check is new interval overlaping old interval
//             const existingIntervalDoc = await RuleInterval.findAll({
//                 where: { rule_id: ruleDoc.id, is_active: true, counselor_id: user.id, date: currDate },
//                 attributes: ['id', 'rule_id', 'date', 'from', 'to', 'time_zone', 'duration_in_minuites'],
//             });
//             if (existingIntervalDoc) {
//                 const isNewIntervalOverlap = isSameDayOverlap({ from: start_time, to: end_time }, existingIntervalDoc, currDate);
//                 if (isNewIntervalOverlap) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'New start_time and end_time is overlaping your old timing. Please select time accordingly.');
//             };

//             // Differance between current timezone and UTC timezone time.
//             let timeOffset = calculateTimeOffset(`${currDate}T${start_time}`, timezone);
//             if (!timeOffset) throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid Date or Timezone.');

//             // If no overlap then create new interval
//             let intervalObject = {
//                 rule_id: ruleDoc.id,
//                 counselor_id: user.id,
//                 date: currDate,
//                 from: start_time,
//                 to: end_time,
//                 duration_in_minuites: duration,
//                 slot_division_in_minuites: slot_duration_in_minuites,
//                 time_zone: timezone,
//                 week_no: startTimeInfo.local.weekNumber,
//                 month_no: startTimeInfo.local.monthNumber,
//                 year: startTimeInfo.local.year,
//                 is_active: true,
//                 time_offset: timeOffset,
//                 created_at: moment(),
//                 maximum_available_seats : maximum_available_seats ? maximum_available_seats : 25,
//             };
//             const [intervalDoc, isNewIntervalCreated] = await RuleInterval.findOrCreate({
//                 where: { rule_id: ruleDoc.id, date: currDate, from: start_time, to: end_time, is_active: true, counselor_id: user.id, },
//                 defaults: intervalObject
//             });
//             if (!intervalDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create interval');

//             // Divide slots followed by Slot Divion in Minuites.
//             let slotsTimeDivisionArr = generateTimeSlots(`${currDate}T${start_time}`, `${currDate}T${end_time}`, slot_duration_in_minuites);
//             if (!slotsTimeDivisionArr) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Error in slot division');

//             // Create Slots according to the duration_in_minuites provided by Counselor
//             for (let j = 0; j < slotsTimeDivisionArr.length; j++) {
//                 let currSlot = slotsTimeDivisionArr[j];
//                 let currSlotStartTime = currSlot.startTime;
//                 let currSlotEndTime = currSlot.endTime;

//                 let slotStartTimeInfo = await getDayInfo(`${currDate}T${currSlotStartTime}`, timezone);
//                 let slotEndTimeInfo = await getDayInfo(`${currDate}T${currSlotEndTime}`, timezone);

//                 let slotObj = {
//                     counselor_id: user.id,
//                     interval_id: intervalDoc.id,
//                     slot_duration_in_minuites: slot_duration_in_minuites,
//                     time_zone: timezone,
//                     slot_date_local: slotStartTimeInfo.local.date,
//                     slot_start_time_local: slotStartTimeInfo.local.time,
//                     slot_end_time_local: slotEndTimeInfo.local.time,
//                     day_no_local: slotStartTimeInfo.local.dayNumber,
//                     day_name_local: slotStartTimeInfo.local.dayName,
//                     week_no_local: slotStartTimeInfo.local.weekNumber,
//                     month_no_local: slotStartTimeInfo.local.monthNumber,
//                     month_name_local: slotStartTimeInfo.local.monthName,
//                     time_offset: timeOffset,
//                     is_available: true,
//                     remaining_appointment : intervalDoc.maximum_available_seats
//                 };
//                 try {
//                     await Slot.create(slotObj);
//                 } catch (error) {
//                     console.log("Erroe While Creating Slots : ", error);
//                     continue;
//                 }
//             };
//         };
//         return "Availabiliy Created Successfully."

//     } catch (error) {
//         throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
//     }
// };

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
		// return { start_time, end_time, existingSlots, day, userId: user.id, overlaping: isOverlapping(start_time, end_time, existingSlots) }

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

const updateAvailabilitySpecificdate = async () => {};

// function isOverlapping(startTime, endTime, existingSlots) {
//     const newStart = new Date(`1970-01-01T${startTime}:00`).getTime();
//     const newEnd = new Date(`1970-01-01T${endTime}:00`).getTime();

//     return existingSlots.some(slot => {
//         const existingStart = new Date(`1970-01-01T${slot.start_time}:00`).getTime();
//         const existingEnd = new Date(`1970-01-01T${slot.end_time}:00`).getTime();
//         return (newStart < existingEnd && newEnd > existingStart);
//     });
// }

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

// For Counselor Profile
// const getSchedulRuleAndIntervalByCounselorToken = async (body, header) => {

//     try {
//         const { user } = body;
//         const { timezone } = header;
//         const currentDayDetails = getCurrentDayDetails(timezone);

//         const scheduleDoc = await ScheduleRule.findAll({
//             attributes: ['id', 'counselor_id', 'time_zone', 'type', 'day_name_local',],
//             where: { counselor_id: user.id, is_active: true },
//             include: [
//                 {
//                     model: RuleInterval,
//                     as: 'rule_intervals',
//                     attributes: ['id', 'rule_id', 'from', 'to', 'slot_division_in_minuites'],
//                     where: { week_no: currentDayDetails.currentWeekNumber, month_no: currentDayDetails.currentMonthNumber, year: currentDayDetails.currentYear, is_active: true },
//                 },
//             ],
//             order: [
//                 [
//                     sequelize.literal('FIELD(day_name_local, "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday")'),
//                 ],
//                 [sequelize.col('rule_intervals.id', 'ASC')]
//             ],
//         });
//         if (!scheduleDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to fetch schedule');
//         return scheduleDoc;

//     } catch (error) {
//         throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
//     }
// };

// For user  to see counselor availability and slots
// const getAvailabilityByCounselorId = async (body, header, params) => {
//     try {

//         const { user } = body;
//         let { timezone } = header;
//         const { counselorId } = params;

//         // Verify Counselor Id Valid Or Not
//         const counselorDoc = await User.findOne({
//             where: { id: counselorId, role_id: config.CLLR_ROLE_ID }
//         });
//         if (!counselorDoc || Object.keys(counselorDoc).length === 0) {
//             throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid Counselor Id.');
//         };

//         //Find All intervals and slots
//         const ruleWithIntervalDoc = await ScheduleRule.findAll({
//             where: { counselor_id: counselorId, is_active: true },
//             attributes: ['id', 'counselor_id', 'time_zone', 'type', 'day_name_local',],
//             include: [
//                 {
//                     model: RuleInterval,
//                     as: 'rule_intervals',
//                     attributes: ['id', 'rule_id', 'from', 'to', 'time_zone', 'duration_in_minuites', 'slot_division_in_minuites', 'date', 'counselor_id'],
//                     include: [
//                         {
//                             model: Slot,
//                             as: 'interval_slots',
//                             attributes: [
//                                 'id', 'time_zone', 'counselor_id', 'interval_id', 'slot_duration_in_minuites', 'time_zone',
//                                 'slot_date_local', 'slot_start_time_local', 'slot_end_time_local', 'day_no_local',
//                                 'day_name_local', 'week_no_local', 'month_no_local', 'month_name_local', 'time_offset', 'is_booked'
//                             ],
//                         },
//                     ],
//                     order: [['date', 'DESC']]
//                 },
//             ],
//             order: [
//                 [
//                     sequelize.literal('FIELD(ScheduleRule.day_name_local, "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday")'),
//                 ],
//             ],
//         });
//         if (!ruleWithIntervalDoc) throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to fetch rules');

//         // Modify data according to timezone
//         const modifiedData = ruleWithIntervalDoc.map(rule => {
//             const modifiedRule = {
//                 id: rule.id,
//                 // counselor_id: rule.counselor_id,
//                 // time_zone: rule.time_zone,
//                 type: rule.type,
//                 day_name_local: rule.day_name_local,
//                 rule_intervals: rule.rule_intervals.map(interval => {
//                     const modifiedInterval = {
//                         id: interval.id,
//                         // rule_id: interval.rule_id,
//                         // counselor_id: interval.counselor_id,
//                         from: interval.from,
//                         to: interval.to,
//                         // time_zone: interval.time_zone,
//                         // duration_in_minuites: interval.duration_in_minuites,
//                         // slot_division_in_minuites: interval.slot_division_in_minuites,
//                         date: interval.date,
//                         interval_slots: interval.interval_slots.map(slot => {
//                             const slotDate = moment.tz(`${slot.slot_date_local} ${slot.slot_start_time_local}`, slot.time_zone);
//                             const convertedSlotDate = slotDate.clone().tz(timezone);
//                             const modifiedSlot = {
//                                 //Existing property
//                                 id: slot.id,
//                                 counselor_id: slot.counselor_id,
//                                 interval_id: slot.interval_id,
//                                 is_booked: slot.is_booked,
//                                 // time_zone: slot.time_zone,
//                                 // slot_date_local: slot.slot_date_local,
//                                 // slot_start_time_local: slot.slot_start_time_local,
//                                 // slot_end_time_local: slot.slot_end_time_local,

//                                 // Modified time and date according to timezone
//                                 curr_date: convertedSlotDate.format("YYYY-MM-DD"),
//                                 curr_starttime: convertedSlotDate.format("HH:mm:ss"),
//                                 curr_endtime: convertedSlotDate.add(interval.slot_division_in_minuites, 'minutes').format("HH:mm:ss"),
//                                 // curr_day_no_local: convertedSlotDate.format("D"),
//                                 // curr_day_name_local: convertedSlotDate.format("dddd"),
//                                 // curr_week_no_local: convertedSlotDate.format("W"),
//                                 // curr_month_no_local: convertedSlotDate.format("M"),
//                                 // curr_month_name_local: convertedSlotDate.format("MMMM"),
//                             };
//                             return modifiedSlot;
//                         }),
//                     };
//                     return modifiedInterval;
//                 }),
//             };
//             return modifiedRule;
//         });

//         // Format the data for frontend
//         const formattedData = {};
//         modifiedData.forEach(rule => {
//             rule.rule_intervals.forEach(interval => {
//                 interval.interval_slots.forEach(slot => {
//                     const { curr_date, ...rest } = slot;
//                     if (!formattedData[curr_date]) {
//                         formattedData[curr_date] = [];
//                     }
//                     formattedData[curr_date].push(rest);
//                 });
//             });
//         });
//         for (const date in formattedData) {
//             formattedData[date].sort((a, b) => a.curr_starttime.localeCompare(b.curr_starttime));
//         }
//         const dataArray = Object.keys(formattedData).map(date => ({
//             [date]: formattedData[date]
//         }));

//         // Sort the data according to date and start time
//         dataArray.sort((a, b) => {
//             const dateA = Object.keys(a)[0];
//             const dateB = Object.keys(b)[0];
//             return new Date(dateA) - new Date(dateB);
//         });
//         return dataArray;

//     } catch (error) {
//         throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
//     }
// };

module.exports = {
	createAvailability,
	getSchedulRuleAndIntervalByCounselorToken,
	getAvailabilityByCounselorId,
	deleteAvailability,
	updateAvailability,
	updateAvailabilitySpecificdate,
};
