// Date and time helpers on Luxon. Import DateTime from here rather than from 'luxon' so every caller
// shares the same settings: English month and day names whatever the server's locale is.
// Never hand a DateTime to Sequelize; pass a Date (`toJSDate()`) or a formatted string.
const { DateTime, Settings } = require('luxon');

Settings.defaultLocale = 'en-US';

// A Date, ISO string, SQL datetime string ("2026-10-14 09:30:00", read in the server's zone) or epoch
// milliseconds, as a DateTime.
const toDateTime = (value) => {
    if (value instanceof Date) return DateTime.fromJSDate(value);
    if (typeof value === 'number') return DateTime.fromMillis(value);
    const iso = DateTime.fromISO(String(value));
    return iso.isValid ? iso : DateTime.fromSQL(String(value));
};

const ordinal = (n) => {
    const suffixes = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]}`;
};

// "October 14th 2026"
const longDate = (value) => {
    const dt = toDateTime(value);
    return `${dt.toFormat('MMMM')} ${ordinal(dt.day)} ${dt.year}`;
};

// Today's date in the server's zone, "2026-10-14".
const todayDate = () => DateTime.now().toISODate();

// How long ago something was created, as the app shows it: "40s", "12m", "5h", "3d", and from 5 days on
// the creation date itself. `date` is the creation time in the viewer's zone ("14 Oct, 2026 09:30 PM").
const timeAgo = (createdAt, zone) => {
    const created = toDateTime(createdAt).setZone(zone);
    const date = created.toFormat('dd MMM, yyyy hh:mm a');
    const seconds = Math.max(0, Math.floor((Date.now() - created.toMillis()) / 1000));
    const days = Math.floor(seconds / 86400);
    let ago;
    if (days >= 5) ago = date;
    else if (days >= 1) ago = `${days}d`;
    else if (seconds >= 3600) ago = `${Math.floor(seconds / 3600)}h`;
    else if (seconds >= 60) ago = `${Math.floor(seconds / 60)}m`;
    else ago = `${seconds}s`;
    return { date, ago };
};

// Timing of an appointment slot (date "yyyy-MM-dd" and start time "HH:mm:ss" in the slot's zone), as seen
// from the viewer's zone.
const slotTiming = (date, startTime, slotZone, viewerZone) => {
    const start = DateTime.fromFormat(`${date} ${startTime}`, 'yyyy-MM-dd HH:mm:ss', { zone: slotZone }).setZone(viewerZone);
    const now = DateTime.now().setZone(viewerZone);
    return {
        start_time_with_date: start.toFormat('dd MMMM hh:mm:ss a'),
        is_upcoming: now < start,
        is_completed: now > start,
        is_today_and_greater: now.hasSame(start, 'day') && now <= start,
    };
};

module.exports = { DateTime, toDateTime, longDate, todayDate, timeAgo, slotTiming };
