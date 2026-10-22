// Page analytics (Phase 6, the website's requests): the website reports views of a professional's or brand's page and
// clicks on its links (website, Access card, products, booking, social, email, phone), as card analytics does for
// cards, and the owner sees the numbers in the dashboard (GET /my/profile/analytics; admins any page's). An event keeps
// no address or browser string: the visitor's random id (for unique visitors), the kind of device and what was clicked.
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const sequelize = require('../../core/db/central.db');
const { deviceType, isRobot } = require('../../core/http/visitor');
const { visibleAccountId, pageLinks } = require('./profileQuery');

const VIEW = 'PAGE_VIEW';
const EVENTS = [VIEW, 'WEBSITE_CLICK', 'ACCESS_CARD_CLICK', 'PRODUCT_CLICK', 'BOOKING_CLICK', 'SOCIAL_CLICK', 'EMAIL_CLICK', 'PHONE_CLICK'];

const refuse = (field, message, code = 'INVALID_INPUT') => ApiError.withCode(httpStatus.BAD_REQUEST, message, code, { field });
const clip = (value, max) => (typeof value === 'string' || typeof value === 'number' ? String(value).trim().slice(0, max) || null : null);

// POST /profiles/:slug/events { event_type, event_target?, visitor_id?, session_id? }: one event on a visible page.
// Robots are answered but not counted.
const track = async (slug, body = {}, userAgent = '') => {
    if (!EVENTS.includes(body.event_type)) throw refuse('event_type', `event_type is one of ${EVENTS.join(', ')}.`, 'INVALID_PAGE_EVENT');
    const userId = await visibleAccountId(slug);
    if (!userId) throw ApiError.withCode(httpStatus.NOT_FOUND, 'Page not found.', 'NOT_FOUND');
    if (isRobot(userAgent)) return { counted: false };
    await sequelize.query(
        `INSERT INTO profile_page_events (user_id, event_type, event_target, visitor_id, session_id, device_type)
         VALUES (:userId, :type, :target, :visitor, :session, :device)`,
        {
            replacements: {
                userId,
                type: body.event_type,
                target: clip(body.event_target, 500),
                visitor: clip(body.visitor_id, 100),
                session: clip(body.session_id, 100),
                device: deviceType(userAgent),
            },
        },
    );
    return { counted: true };
};

const DAY = 24 * 60 * 60 * 1000;
const dayOf = (time) => new Date(time).toISOString().slice(0, 10);

// `from` and `to` (YYYY-MM-DD; today when not given, as for cards): real dates, not in the future, from before to.
// Days are the database's, as events are dated by it.
const dateRange = async (query) => {
    const [[{ today }]] = await sequelize.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today");
    const range = { from: query.from || today, to: query.to || today };
    for (const [field, value] of Object.entries(range)) {
        const time = Date.parse(`${value}T00:00:00Z`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(time) || dayOf(time) !== value) throw refuse(field, `${field} is a date (YYYY-MM-DD).`);
        if (value > today) throw refuse(field, `${field} cannot be in the future.`);
    }
    if (range.from > range.to) throw refuse('from', 'from cannot be after to.');
    return range;
};

// One page's numbers between `from` and `to`, as card analytics gives a card's: views, unique visitors and clicks,
// each event's count, views and clicks by day (days with any), devices, and the most clicked links and products
// (`event_target`: what the website sent, a product's id for PRODUCT_CLICK).
const analytics = async (userId, query = {}) => {
    const { from, to } = await dateRange(query);
    const page = (await pageLinks([userId], { hidden: true })).get(Number(userId));
    if (!page) throw ApiError.withCode(httpStatus.NOT_FOUND, 'Page not found.', 'NOT_FOUND');
    const replacements = { userId: page.id, from: `${from} 00:00:00`, until: `${dayOf(Date.parse(`${to}T00:00:00Z`) + DAY)} 00:00:00`, view: VIEW };
    const RANGE = 'user_id = :userId AND created_at >= :from AND created_at < :until';
    const rows = async (sql) => (await sequelize.query(sql, { replacements }))[0];
    const [counts, [visitors], days, devices, targets] = await Promise.all([
        rows(`SELECT event_type, COUNT(*) AS count FROM profile_page_events WHERE ${RANGE} GROUP BY event_type`),
        rows(`SELECT COUNT(DISTINCT visitor_id) AS count FROM profile_page_events WHERE ${RANGE} AND event_type = :view`),
        rows(`SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS date, SUM(event_type = :view) AS views, SUM(event_type <> :view) AS clicks
              FROM profile_page_events WHERE ${RANGE} GROUP BY date ORDER BY date`),
        rows(`SELECT device_type, COUNT(*) AS count FROM profile_page_events WHERE ${RANGE} AND event_type = :view
              GROUP BY device_type ORDER BY count DESC, device_type`),
        rows(`SELECT event_type, event_target, COUNT(*) AS count FROM profile_page_events
              WHERE ${RANGE} AND event_type <> :view AND event_target IS NOT NULL
              GROUP BY event_type, event_target ORDER BY count DESC, event_type, event_target LIMIT 10`),
    ]);
    const events = Object.fromEntries(EVENTS.map((type) => [type, 0]));
    for (const row of counts) events[row.event_type] = Number(row.count);
    return {
        page: { id: page.id, slug: page.slug, name: page.name, visible: page.visible },
        date_range: { from, to },
        summary: {
            total_views: events[VIEW],
            unique_visitors: Number(visitors.count),
            total_clicks: EVENTS.filter((type) => type !== VIEW).reduce((sum, type) => sum + events[type], 0),
        },
        events,
        daily_views: days.filter((d) => Number(d.views)).map((d) => ({ date: d.date, count: Number(d.views) })),
        daily_clicks: days.filter((d) => Number(d.clicks)).map((d) => ({ date: d.date, count: Number(d.clicks) })),
        device_breakdown: devices.map((d) => ({ device_type: d.device_type, count: Number(d.count) })),
        top_targets: targets.map((t) => ({ event_type: t.event_type, event_target: t.event_target, count: Number(t.count) })),
    };
};

module.exports = { track, analytics, EVENTS };
