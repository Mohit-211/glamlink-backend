// What the website reports about its ads: views (an impression, once an ad is half in view) and clicks, counted per
// ad and day (ad_stats) for admins; and the ads to show now (GET /ads?live=true).
const { Op, literal } = require('sequelize');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const sequelize = require('../../core/db/central.db');
const { wholeNumber } = require('../../core/utils/formValues');
const { Ad } = require('../../models');

const refuse = (field, message) => ApiError.withCode(httpStatus.BAD_REQUEST, message, 'INVALID_AD_EVENT', { field });

// POST /ads/track { ad_id, type: "impression" | "click" }: adds one to the ad's count for today.
const track = async (body) => {
    const type = body.type;
    if (!['impression', 'click'].includes(type)) throw refuse('type', 'type is impression or click.');
    const id = wholeNumber(body.ad_id);
    const ad = id && (await Ad.findOne({ where: { id, is_active: true }, attributes: ['id'] }));
    if (!ad) throw refuse('ad_id', 'No such ad.');
    const column = type === 'impression' ? 'impressions' : 'clicks';
    await sequelize.query(
        `INSERT INTO ad_stats (ad_id, day, ${column}) VALUES (:id, CURDATE(), 1) ON DUPLICATE KEY UPDATE ${column} = ${column} + 1`,
        { replacements: { id: ad.id } },
    );
    return { counted: true };
};

// The ads to show now: active, inside their dates (whole days), in their order; `slot` and `page` narrow them
// (an ad lists the pages it runs on).
const liveAds = async (query = {}) => {
    const where = {
        is_active: true,
        status: 'active',
        [Op.and]: [
            { [Op.or]: [{ start_date: null }, literal('DATE(`Ad`.`start_date`) <= CURDATE()')] },
            { [Op.or]: [{ end_date: null }, literal('DATE(`Ad`.`end_date`) >= CURDATE()')] },
        ],
        ...(query.slot && { slot_id: String(query.slot) }),
    };
    const ads = await Ad.findAll({ where, order: [['sort_order', 'ASC'], ['id', 'ASC']] });
    const rows = query.page ? ads.filter((ad) => (ad.pages || []).includes(String(query.page))) : ads;
    return { count: rows.length, rows };
};

const day = (value, field) => {
    if (value === undefined || value === '') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) throw refuse(field, `${field} is YYYY-MM-DD.`);
    return String(value);
};

const range = (query) => ({ from: day(query.from, 'from'), to: day(query.to, 'to') });
const RANGE = '(:from IS NULL OR day >= :from) AND (:to IS NULL OR day <= :to)';

// Admins: each ad's views and clicks between `from` and `to` (both optional, YYYY-MM-DD), with the click rate.
const totals = async (query = {}) => {
    const [rows] = await sequelize.query(
        `SELECT ad_id, SUM(impressions) AS impressions, SUM(clicks) AS clicks FROM ad_stats WHERE ${RANGE} GROUP BY ad_id ORDER BY ad_id`,
        { replacements: range(query) },
    );
    return rows.map((row) => {
        const impressions = Number(row.impressions);
        const clicks = Number(row.clicks);
        return { ad_id: Number(row.ad_id), impressions, clicks, click_rate: impressions ? Math.round((clicks / impressions) * 10000) / 100 : null };
    });
};

// Admins: one ad's views and clicks per day between `from` and `to`.
const daily = async (id, query = {}) => {
    const ad = await Ad.findByPk(id, { attributes: ['id'] });
    if (!ad) throw ApiError.withCode(httpStatus.NOT_FOUND, 'Ad not found.', 'NOT_FOUND');
    const [rows] = await sequelize.query(
        `SELECT DATE_FORMAT(day, '%Y-%m-%d') AS day, impressions, clicks FROM ad_stats WHERE ad_id = :id AND ${RANGE} ORDER BY day`,
        { replacements: { id: ad.id, ...range(query) } },
    );
    const days = rows.map((row) => ({ day: row.day, impressions: Number(row.impressions), clicks: Number(row.clicks) }));
    return {
        ad_id: ad.id,
        impressions: days.reduce((sum, d) => sum + d.impressions, 0),
        clicks: days.reduce((sum, d) => sum + d.clicks, 0),
        days,
    };
};

module.exports = { track, liveAds, totals, daily };
