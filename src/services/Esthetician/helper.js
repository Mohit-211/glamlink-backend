const moment = require('moment');
const momentTz = require('moment-timezone');

function calculateDuration(startTime, endTime) {
    const format = 'HH:mm:ss';
    const startMoment = moment(startTime, format);
    const endMoment = moment(endTime, format);

    const duration = moment.duration(endMoment.diff(startMoment));
    const durationInMinutes = duration.asMinutes();

    return durationInMinutes;
};

function isSameTimeOverlap(newInterval, existingIntervals) {
    for (const interval of existingIntervals) {
        const newFrom = moment(newInterval.from, 'HH:mm:ss');
        const newTo = moment(newInterval.to, 'HH:mm:ss');
        const existingFrom = moment(interval.from, 'HH:mm:ss');
        const existingTo = moment(interval.to, 'HH:mm:ss');

        if (newFrom.isBefore(existingTo) && newTo.isAfter(existingFrom)) {
            return true;
        }
    }
    return false;
};

function isSameDayOverlap(newInterval, existingIntervals, date) {
    const newFrom = moment(`${date} ${newInterval.from}`, 'YYYY-MM-DD HH:mm:ss');
    const newTo = moment(`${date} ${newInterval.to}`, 'YYYY-MM-DD HH:mm:ss');

    for (const interval of existingIntervals) {
        const existingFrom = moment(`${interval.date} ${interval.from}`, 'YYYY-MM-DD HH:mm:ss');
        const existingTo = moment(`${interval.date} ${interval.to}`, 'YYYY-MM-DD HH:mm:ss');

        if (newFrom.isBefore(existingTo) && newTo.isAfter(existingFrom)) {
            return true;
        }
    };
    return false;
};

function generateTimeSlots(startTime, endTime, intervalMinutes) {
    const slots = [];
    let currentSlot = moment(startTime);
    const endMoment = moment(endTime);

    while (currentSlot.isSameOrBefore(endMoment) && currentSlot.add(intervalMinutes, 'minutes').isSameOrBefore(endMoment)) {
        const startTime = currentSlot.subtract(intervalMinutes, 'minutes').format('HH:mm');
        currentSlot.add(intervalMinutes, 'minutes');
        const endTime = currentSlot.format('HH:mm');
        slots.push({ startTime, endTime });
    };
    return slots;
};


function getDayInfo(dateString, targetTimeZone, convertTimeZone = 'UTC') {
    const utcDate = convertLocalToUtc(dateString, targetTimeZone, convertTimeZone);
    const localDate = momentTz.tz(dateString, targetTimeZone);

    const utcDayName = utcDate.format('dddd');
    const utcDayNumber = utcDate.date();
    const utcTime = utcDate.format('HH:mm:ss');
    const utcYear = utcDate.year();
    const utcWeekNumber = utcDate.isoWeek();
    const utcMonthName = utcDate.format('MMMM');
    const utcMonthNumber = utcDate.month() + 1;

    const localDayName = localDate.format('dddd');
    const localDayNumber = localDate.date();
    const localTime = localDate.format('HH:mm:ss');
    const localYear = localDate.year();
    const localWeekNumber = localDate.isoWeek();
    const localMonthName = localDate.format('MMMM');
    const localMonthNumber = localDate.month() + 1;

    return {
        utc: {
            dayName: utcDayName,
            dayNumber: utcDayNumber,
            date: utcDate.format('YYYY-MM-DD'),
            time: utcTime,
            year: utcYear,
            weekNumber: utcWeekNumber,
            monthName: utcMonthName,
            monthNumber: utcMonthNumber,
        },
        local: {
            dayName: localDayName,
            dayNumber: localDayNumber,
            date: localDate.format('YYYY-MM-DD'),
            time: localTime,
            year: localYear,
            weekNumber: localWeekNumber,
            monthName: localMonthName,
            monthNumber: localMonthNumber,
        },
    };
};

function convertLocalToUtc(localTimeString, sourceTimeZone, targetTimeZone) {
    const localMoment = momentTz.tz(localTimeString, sourceTimeZone);
    const utcMoment = localMoment.clone().tz(targetTimeZone);
    return utcMoment;
};


function calculateTimeOffset(dateString, sourceTimeZone) {
    const dateMoment = moment.tz(dateString, sourceTimeZone);
    const utcOffsetInMinutes = dateMoment.utcOffset();
    const utcOffsetInHours = utcOffsetInMinutes / 60;
    return utcOffsetInHours;
};

// calculate how many differance of timezone2 from timezone 1
function getTimeDifference(timezone1, timezone2) {
    const now = momentTz();

    // Format the time in the first time zone
    const time1 = now.clone().tz(timezone1).format('YYYY-MM-DD HH:mm:ss');

    // Format the time in the second time zone
    const time2 = now.clone().tz(timezone2).format('YYYY-MM-DD HH:mm:ss');

    // Parse the formatted times into moment objects
    const date1 = momentTz(time1, 'YYYY-MM-DD HH:mm:ss');
    const date2 = momentTz(time2, 'YYYY-MM-DD HH:mm:ss');

    // Calculate the time difference in milliseconds
    const timeDifferenceMs = date2 - date1;

    // Convert milliseconds to hours and minutes
    const hours = Math.floor(timeDifferenceMs / (1000 * 60 * 60));
    const minutes = Math.floor((timeDifferenceMs % (1000 * 60 * 60)) / (1000 * 60));

    return { hours, minutes };
};

function getDatesForWeekCount(weekCount) {
    const today = moment().startOf('week'); // Start from the beginning of the current week (Sunday)
    const allDates = [];

    for (let i = 0; i < weekCount * 7; i++) {
        const currentDate = today.clone().add(i, 'days');
        const formattedDate = currentDate.format('YYYY-MM-DD');

        allDates.push(formattedDate);
    }

    return allDates;
};


function getAllFutureDatesForDayInCurrentMonth(dayName) {
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastDayOfMonth = new Date(year, month, 0);

    let currentDate = new Date(today);

    while (currentDate <= lastDayOfMonth) {
        if (currentDate.getDay() === getDayIndex(dayName)) {
            dates.push(new Date(currentDate).toISOString().split('T')[0]);
        }
        currentDate.setDate(currentDate.getDate() + 1);
    };
    return dates;
};

function getDayIndex(dayName) {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return daysOfWeek.indexOf(dayName);
};

function getCurrentDayDetails(timezone) {
    // Get the current date in the specified timezone
    const currentDate = momentTz().tz(timezone);

    // Get the week number, month number, and year
    const currentWeekNumber = currentDate.week();
    const currentMonthNumber = currentDate.month() + 1; // Adding 1 because months are zero-based
    const currentYear = currentDate.year();
    return {currentWeekNumber, currentMonthNumber, currentYear }
};
module.exports = {
    calculateDuration,
    isSameTimeOverlap,
    isSameDayOverlap,
    getDayInfo,
    generateTimeSlots,
    calculateTimeOffset,
    getTimeDifference,
    getDatesForWeekCount,
    getAllFutureDatesForDayInCurrentMonth,
    getCurrentDayDetails,
}