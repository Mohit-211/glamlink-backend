// Admins and videos: every video with its status, editing one (series, status, featuring, people, topics), pasting a
// YouTube link, importing each series' playlist (also hourly, see index.js), and the series themselves.
const { Op } = require('sequelize');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const logger = require('../../core/logger');
const { paging, idList } = require('../../core/http/paging');
const { containing } = require('../../core/utils/like');
const { isYes, wholeNumber } = require('../../core/utils/formValues');
const { toSlug } = require('../../core/utils/slug');
const { youtube, configured, videoIdFrom } = require('../../integrations/youtube');
const { Video, VideoSeries, VideoPerson, JournalTopicVideoMapping, JournalTopic, User } = require('../../models');
const { toCard, CARD, SERIES } = require('./video.service');

const refuse = (field, message) => ApiError.withCode(httpStatus.BAD_REQUEST, message, 'INVALID_VIDEO', { field });
const notFound = (what = 'Video') => ApiError.withCode(httpStatus.NOT_FOUND, `${what} not found.`, 'NOT_FOUND');

const notConfigured = () => ApiError.withCode(httpStatus.SERVICE_UNAVAILABLE, 'YouTube is not set up on the server (YOUTUBE_API_KEY).', 'YOUTUBE_NOT_CONFIGURED');

// YouTube's answer, or a 503 (no key) / 502 (YouTube failed) the admin can act on.
const fromYoutube = async (call) => {
    if (!configured()) throw notConfigured();
    try {
        return await call();
    } catch (err) {
        logger.warn(`YouTube: ${err.message}`);
        throw ApiError.withCode(httpStatus.BAD_GATEWAY, 'YouTube did not answer. Try again in a moment.', 'YOUTUBE_UNAVAILABLE');
    }
};

// A free slug from a title: glow-up, then glow-up-2, ...
const freeSlug = async (title, id = null) => {
    const base = toSlug(title).slice(0, 150) || 'video';
    for (let n = 1; ; n++) {
        const slug = n === 1 ? base : `${base}-${n}`;
        const taken = await Video.findOne({ where: { slug, ...(id && { id: { [Op.ne]: id } }) }, attributes: ['id'] });
        if (!taken) return slug;
    }
};

const create = async (details, { seriesId = null, source }) =>
    Video.create({ ...details, slug: await freeSlug(details.title), series_id: seriesId, source, status: 'published' });

// Every video, drafts too, newest first: series (id or slug), status, search, page, limit (50).
const listAll = async (query = {}) => {
    const { limit, offset } = paging(query, { defaultLimit: 50 });
    const where = {};
    if (['draft', 'published'].includes(query.status)) where.status = query.status;
    if (query.series) {
        const series = await VideoSeries.findOne({ where: wholeNumber(query.series) ? { id: query.series } : { slug: String(query.series) }, attributes: ['id'] });
        if (!series) return { count: 0, rows: [] };
        where.series_id = series.id;
    }
    const search = String(query.search ?? '').trim();
    if (search) where.title = { [Op.like]: containing(search) };
    const { count, rows } = await Video.findAndCountAll({
        attributes: [...CARD, 'status', 'source', 'series_id'],
        where,
        include: [SERIES],
        order: [['published_at', 'DESC'], ['id', 'DESC']],
        limit,
        offset,
        distinct: true,
    });
    return { count, rows: rows.map((video) => ({ ...toCard(video), status: video.status, source: video.source })) };
};

// One video as admins edit it: the card, description, status, its people (every account, with its role) and topics.
const adminView = async (id) => {
    const video = await Video.findByPk(id, { include: [SERIES] });
    if (!video) throw notFound();
    const people = await VideoPerson.findAll({ where: { video_id: video.id }, attributes: ['user_id', 'role'], order: [['id', 'ASC']] });
    const topics = await JournalTopicVideoMapping.findAll({ where: { video_id: video.id }, attributes: ['topic_id'], order: [['sort_order', 'ASC']] });
    return {
        ...toCard(video),
        description: video.description,
        status: video.status,
        source: video.source,
        featured_order: video.featured_order,
        people: people.map((p) => ({ user_id: Number(p.user_id), role: p.role })),
        topic_ids: topics.map((t) => Number(t.topic_id)),
    };
};

const seriesId = async (value) => {
    if (value === null || value === '') return null;
    const series = wholeNumber(value) && (await VideoSeries.findByPk(wholeNumber(value), { attributes: ['id'] }));
    if (!series) throw refuse('series_id', 'series_id must be a series.');
    return series.id;
};

// title, slug, description, series_id ("" for none), status, is_featured, featured_order: those sent change.
const updateVideo = async (id, body) => {
    const video = await Video.findByPk(id);
    if (!video) throw notFound();
    const changes = {};
    if (body.title !== undefined) {
        const title = String(body.title).trim();
        if (!title || title.length > 255) throw refuse('title', 'title is 1 to 255 characters.');
        changes.title = title;
    }
    if (body.slug !== undefined) {
        const slug = toSlug(body.slug);
        if (slug.length < 3) throw refuse('slug', 'slug is at least 3 letters, digits and dashes.');
        if (await Video.findOne({ where: { slug, id: { [Op.ne]: video.id } }, attributes: ['id'] })) throw refuse('slug', 'This slug is taken.');
        changes.slug = slug;
    }
    if (body.description !== undefined) changes.description = String(body.description ?? '').trim() || null;
    if (body.series_id !== undefined) changes.series_id = await seriesId(body.series_id);
    if (body.status !== undefined) {
        if (!['draft', 'published'].includes(body.status)) throw refuse('status', 'status is draft or published.');
        changes.status = body.status;
    }
    if (body.is_featured !== undefined) changes.is_featured = isYes(body.is_featured);
    if (body.featured_order !== undefined && body.featured_order !== '') {
        const order = wholeNumber(body.featured_order);
        if (order === null) throw refuse('featured_order', 'featured_order must be a whole number.');
        changes.featured_order = order;
    }
    await video.update(changes);
    return adminView(video.id);
};

// The people in a video, all at once: [{ user_id, role }] (role host, guest or featured), professional accounts.
const setPeople = async (id, body) => {
    const video = await Video.findByPk(id, { attributes: ['id'] });
    if (!video) throw notFound();
    const people = Array.isArray(body.people) ? body.people : typeof body.people === 'string' ? JSON.parse(body.people || '[]') : null;
    if (!people) throw refuse('people', 'people is a list of { user_id, role }.');
    const rows = [];
    for (const person of people) {
        const userId = wholeNumber(person?.user_id);
        const role = person?.role ?? 'featured';
        if (!['host', 'guest', 'featured'].includes(role)) throw refuse('people', 'role is host, guest or featured.');
        const account = userId && (await User.findOne({ where: { id: userId, account_type: 'professional', is_active: true }, attributes: ['id'] }));
        if (!account) throw refuse('people', `${person?.user_id} is not a professional or brand account.`);
        if (!rows.some((row) => row.user_id === userId)) rows.push({ video_id: video.id, user_id: userId, role });
    }
    await VideoPerson.destroy({ where: { video_id: video.id } });
    if (rows.length) await VideoPerson.bulkCreate(rows);
    return adminView(video.id);
};

// A video's topics, all at once, in order.
const setTopics = async (id, body) => {
    const video = await Video.findByPk(id, { attributes: ['id'] });
    if (!video) throw notFound();
    const topicIds = idList(body.topic_ids);
    const topics = topicIds.length ? await JournalTopic.findAll({ where: { id: topicIds, is_active: true }, attributes: ['id'] }) : [];
    if (topics.length !== topicIds.length) throw refuse('topic_ids', 'One or more topics do not exist.');
    await JournalTopicVideoMapping.destroy({ where: { video_id: video.id } });
    if (topicIds.length) await JournalTopicVideoMapping.bulkCreate(topicIds.map((topicId, index) => ({ topic_id: topicId, video_id: video.id, sort_order: index + 1 })));
    return adminView(video.id);
};

// A YouTube link pasted by an admin: the video with its title, thumbnail and duration from YouTube, in the series sent
// (or none). A video already here answers as it is ({ created: false }).
const importVideo = async (body) => {
    const youtubeId = videoIdFrom(body.url);
    if (!youtubeId) throw refuse('url', 'Paste a YouTube video link.');
    const series = body.series_id === undefined ? null : await seriesId(body.series_id);
    const existing = await Video.findOne({ where: { youtube_id: youtubeId }, attributes: ['id'] });
    if (existing) return { created: false, video: await adminView(existing.id) };
    const [details] = await fromYoutube(() => youtube.videoDetails([youtubeId]));
    if (!details) throw refuse('url', 'This is not a public YouTube video.');
    const video = await create(details, { seriesId: series, source: 'admin' });
    return { created: true, video: await adminView(video.id) };
};

// Imports each active series' playlist: the public videos not here yet join their series. Per series, what was
// imported or what went wrong (one bad playlist does not stop the others).
const syncSeries = async () => {
    if (!configured()) throw notConfigured();
    const all = await VideoSeries.findAll({ where: { is_active: true, playlist_id: { [Op.ne]: null } }, order: [['sort_order', 'ASC']] });
    const report = [];
    for (const series of all) {
        try {
            const ids = await youtube.playlistVideoIds(series.playlist_id);
            const known = new Set((await Video.findAll({ where: { youtube_id: ids }, attributes: ['youtube_id'] })).map((v) => v.youtube_id));
            const fresh = ids.filter((id) => !known.has(id));
            const details = fresh.length ? await youtube.videoDetails(fresh) : [];
            for (const video of details) await create(video, { seriesId: series.id, source: 'sync' });
            report.push({ series: series.slug, imported: details.length });
        } catch (err) {
            logger.warn(`YouTube sync of ${series.slug}: ${err.message}`);
            report.push({ series: series.slug, imported: 0, error: err.message });
        }
    }
    return { imported: report.reduce((sum, r) => sum + r.imported, 0), series: report };
};

// --- Series

const listAllSeries = () => VideoSeries.findAll({ order: [['sort_order', 'ASC'], ['name', 'ASC']] });

const seriesFields = async (body, id = null) => {
    const fields = {};
    if (body.name !== undefined) {
        const name = String(body.name).trim();
        if (!name || name.length > 100) throw refuse('name', 'name is 1 to 100 characters.');
        fields.name = name;
    }
    if (body.slug !== undefined || (fields.name && !id)) {
        const slug = toSlug(body.slug ?? fields.name);
        if (slug.length < 2) throw refuse('slug', 'slug is at least 2 letters, digits and dashes.');
        if (await VideoSeries.findOne({ where: { slug, ...(id && { id: { [Op.ne]: id } }) }, attributes: ['id'] })) throw refuse('slug', 'This slug is taken.');
        fields.slug = slug;
    }
    if (body.playlist_id !== undefined) {
        const playlist = String(body.playlist_id ?? '').trim();
        const fromLink = playlist.match(/[?&]list=([\w-]+)/)?.[1];
        if (playlist && !/^[\w-]{10,64}$/.test(fromLink || playlist)) throw refuse('playlist_id', 'playlist_id is a YouTube playlist id or link.');
        fields.playlist_id = fromLink || playlist || null;
    }
    if (body.sort_order !== undefined && body.sort_order !== '') {
        const order = wholeNumber(body.sort_order);
        if (order === null) throw refuse('sort_order', 'sort_order must be a whole number.');
        fields.sort_order = order;
    }
    if (body.is_active !== undefined) fields.is_active = isYes(body.is_active);
    return fields;
};

const createSeries = async (body) => {
    if (body.name === undefined) throw refuse('name', 'name is required.');
    return VideoSeries.create(await seriesFields(body));
};

const updateSeries = async (id, body) => {
    const series = await VideoSeries.findByPk(id);
    if (!series) throw notFound('Series');
    await series.update(await seriesFields(body, series.id));
    return series;
};

module.exports = { listAll, adminView, updateVideo, setPeople, setTopics, importVideo, syncSeries, listAllSeries, createSeries, updateSeries };
