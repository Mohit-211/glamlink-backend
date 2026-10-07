const httpStatus = require('http-status');

const { User, Availability } = require('../models');
const { daysOfWeek } = require('../config/types');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');

const config = require('../config/config');
const responseWrapper = require('../config/responseWrapper');
const { calculateDuration } = require('../services/Esthetician/helper');

function isValidFullDate(dateString) {
    const regex = /^(\d{4})-(\d{2})-(\d{2})$/;
    const match = dateString.match(regex);

    if (!match) return false;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);

    // Check the validity of the date
    const date = new Date(year, month - 1, day);

    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}


const validateCreateScheduleBody = catchAsync(async (req, res, next) => {

    try {
        const { user, timezone, slot_duration_in_minuites, start_time, end_time, day, maximum_available_seats } = req.body;

        if (user.role_id !== Number(config.CLLR_ROLE_ID)) {
            return responseWrapper(res, '', 'Only Counselor can access this route.', httpStatus.BAD_REQUEST);
        };


        if (Number(slot_duration_in_minuites) < 30) {
            return responseWrapper(res, '', 'Slot Duration must be Greater or Equal to 30', httpStatus.BAD_REQUEST);
        };

        if (!daysOfWeek.includes(day)) {
            return responseWrapper(res, '', 'Invalid Day Provided.', httpStatus.BAD_REQUEST);
        };

        if (!isValidTimeFormat(`${start_time}`)) {
            return responseWrapper(res, '', 'Start Time is not Valid type.', httpStatus.BAD_REQUEST);
        };

        if (!isValidTimeFormat(`${end_time}`)) {
            return responseWrapper(res, '', 'End Time is not Valid type.', httpStatus.BAD_REQUEST);
        };
        if (typeof Number(maximum_available_seats) !== 'number' || isNaN(Number(maximum_available_seats)) || Number(maximum_available_seats) <= 0) {
            return responseWrapper(res, '', 'maximum_available_seats must be a valid positive number', httpStatus.BAD_REQUEST);
        }

        if (typeof Number(slot_duration_in_minuites) !== 'number' || isNaN(Number(slot_duration_in_minuites)) || Number(slot_duration_in_minuites) <= 0) {
            return responseWrapper(res, '', 'slot_duration_in_minuites must be a valid positive number', httpStatus.BAD_REQUEST);
        }

        req.body.start_time = convertTime(start_time);
        req.body.end_time = convertTime(end_time);
        req.body.start_time_local = convertTimeTo12hourFormat(req.body.start_time);
        req.body.end_time_local = convertTimeTo12hourFormat(req.body.end_time);

        let duration = calculateDuration(req.body.start_time, req.body.end_time);
        if (duration < slot_duration_in_minuites) {
            return responseWrapper(res, '', 'Please select a valid start and end time intervl', httpStatus.BAD_REQUEST);
        }
        next()

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
});

function isValidTimeFormat(time) {
    // Check if input matches the 12-hour format (HH:MM AM/PM or HH AM/PM)
    const is12HourFormat = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i.test(time);

    if (!is12HourFormat) {
        return false;
    }

    // Extract the hours, minutes (if present), and period (AM/PM) from the input
    const [_, hoursPart, minutesPart, period] = time.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);

    // Convert hours and minutes to integers
    const hours = parseInt(hoursPart, 10);
    const minutes = minutesPart ? parseInt(minutesPart, 10) : 0; // Default to 0 if minutes are not provided

    // Check if hours and minutes are within valid ranges
    if (hours < 1 || hours > 12 || minutes < 0 || minutes >= 60) {
        return false;
    }

    // If all checks pass, return true
    return true;
}


function convertTime(time) {
    // Check if input is in 12-hour format (AM/PM) or 24-hour format (HH:mm)
    const is12HourFormat = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i.test(time);
    const is24HourFormat = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/i.test(time);

    if (!is12HourFormat && !is24HourFormat) {
        return "Invalid time format";
    }

    // Convert time from 12-hour format to 24-hour format
    if (is12HourFormat) {
        const [_, hoursPart, minutesPart, period] = time.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
        const hours = parseInt(hoursPart, 10);
        const minutes = minutesPart ? parseInt(minutesPart, 10) : 0; // Default to 0 if minutes are not provided
        const isPM = period.toUpperCase() === 'PM';

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

        return `${String(hours24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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

        return `${hours12}:${String(minutes).padStart(2, '0')} ${ampm}`;
    }
}

function convertTimeTo12hourFormat(time) {
    // Check if input is in 12-hour format (AM/PM) or 24-hour format (HH:mm)
    const is24HourFormat = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/i.test(time);

    if (!is24HourFormat) {
        return "Invalid time format";
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

        return `${hours12}:${String(minutes).padStart(2, '0')} ${ampm}`;
    }
}


const validateUpdateScheduleBody = catchAsync(async (req, res, next) => {

    try {
        const { user, start_time, end_time, maximum_available_seats, availabilityDoc } = req.body;

        if (!isValidTimeFormat(`${start_time}`)) {
            return responseWrapper(res, '', 'Start Time is not Valid type.', httpStatus.BAD_REQUEST);
        };

        if (!isValidTimeFormat(`${end_time}`)) {
            return responseWrapper(res, '', 'End Time is not Valid type.', httpStatus.BAD_REQUEST);
        };

        if (typeof Number(maximum_available_seats) !== 'number' || isNaN(Number(maximum_available_seats)) || Number(maximum_available_seats) <= 0) {
            return responseWrapper(res, '', 'maximum_available_seats must be a valid positive number', httpStatus.BAD_REQUEST);
        };

        req.body.start_time = convertTime(start_time);
        req.body.end_time = convertTime(end_time);
        req.body.start_time_local = convertTimeTo12hourFormat(req.body.start_time);
        req.body.end_time_local = convertTimeTo12hourFormat(req.body.end_time);

        let duration = calculateDuration(req.body.start_time, req.body.end_time);
        if (duration < availabilityDoc.duration) {
            return responseWrapper(res, '', 'Please select a valid start and end time intervl', httpStatus.BAD_REQUEST);
        }
        next()

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
});


const isAvailabilityOwner = catchAsync(async (req, res, next) => {
    try {
        let { id } = req.params;
        if (!id) return responseWrapper(res, '', 'Please Provide Availability Id', httpStatus.BAD_REQUEST);
        let { user } = req.body;
        let availabilityDoc = await Availability.findOne({ where: { id: id, counselor_id: user.id } });
        if (!availabilityDoc) return responseWrapper(res, '', 'Invalid Availabulity Id', httpStatus.BAD_REQUEST);
        req.body.availabilityDoc = availabilityDoc;
        next()

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
});

const validateFetchAvailabilityForUser = catchAsync(async (req, res, next) => {
    try {
        let { counselor_id, user, dates } = req.body;
        let { timezone } = req.headers;
        if (!counselor_id || !dates) {
            return responseWrapper(
                res,
                '',
                'Please Enter Required Fields : [ counselor_id || dates] in Body',
                httpStatus.BAD_REQUEST
            );
        }

        if (!timezone) {
            return responseWrapper(
                res,
                '',
                'Please Enter Required Fields : [ timezone ] in Headers',
                httpStatus.BAD_REQUEST
            );
        }

        const counselorDoc = await User.findOne({
            where: { id: counselor_id, role_id: config.CLLR_ROLE_ID }
        });
        if (!counselorDoc) return responseWrapper(res, '', 'Invalid Counselor Id.', httpStatus.BAD_REQUEST);
        req.body.counselorDoc = counselorDoc;

        let correctDate = [];
        if (dates && dates !== 'undefined') {
            let dateArr = dates.split(',');
            for (let date of dateArr) {
                if (!isValidFullDate(date))
                    return responseWrapper(
                        res,
                        '',
                        'Invalid date. Please follow [YYYY-MM-DD,YYYY-MM-DD]',
                        httpStatus.BAD_REQUEST
                    );
                correctDate.push(date);
            }
        }
        req.body.dates = correctDate;
        next()

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
});


module.exports = {
    validateCreateScheduleBody,
    isAvailabilityOwner,
    validateUpdateScheduleBody,
    validateFetchAvailabilityForUser,
};