// Watch: every series' videos served from the server (GET /videos, /videos/:slug, /video-series), for the home page's
// Watch + Learn row, the Watch page, profile pages and topic pages.
const { Op, literal } = require('sequelize');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const sequelize = require('../../core/db/central.db');
const { paging } = require('../../core/http/paging');
const { containing } = require('../../core/utils/like');
const { isYes } = require('../../core/utils/formValues');
const { Video, VideoSeries, VideoPerson } = require('../../models');
const { pageLinks } = require('../profiles');

const CARD = ['id', 'slug', 'title', 'youtube_id', 'thumbnail', 'published_at', 'duration_seconds', 'is_featured', 'featured_order', 'created_at'];
const SERIES = { model: VideoSeries, as: 'series', attributes: ['id', 'name', 'slug'] };
const NEWEST = [[literal('COALESCE(`Video`.`published_at`, `Video`.`created_at`)'), 'DESC'], ['id', 'DESC']];
const EMPTY = () => ({ count: 0, rows: [] });

// A video as lists show it.
const toCard = (video) => ({
    id: video.id,
    slug: video.slug,
    title: video.title,
    youtube_id: video.youtube_id,
    thumbnail: video.thumbnail,
    published_at: video.published_at,
    duration_seconds: video.duration_seconds,
    is_featured: Boolean(video.is_featured),
    series: video.series ? { id: video.series.id, name: video.series.name, slug: video.series.slug } : null,
});

const page = async (where, query, order = NEWEST) => {
    const { limit, offset } = paging(query);
    const { count, rows } = await Video.findAndCountAll({ attributes: CARD, where, include: [SERIES], order, limit, offset, distinct: true });
    return { count, rows: rows.map(toCard) };
};

// One page of published videos, newest first (featured=true: the featured ones in their order).
//   series  a series' slug; search  title and description; page, limit (12, at most 50).
const listVideos = async (query = {}) => {
    const where = { status: 'published' };
    const featured = isYes(query.featured);
    if (featured) where.is_featured = true;
    if (query.series) {
        const series = await VideoSeries.findOne({ where: { slug: String(query.series), is_active: true }, attributes: ['id'] });
        if (!series) return EMPTY();
        where.series_id = series.id;
    }
    const search = String(query.search ?? '').trim();
    if (search) {
        const term = containing(search);
        where[Op.or] = [{ title: { [Op.like]: term } }, { description: { [Op.like]: term } }];
    }
    return page(where, query, featured ? [['featured_order', 'ASC'], ...NEWEST] : NEWEST);
};

// The people in a video who have a visible page: [{ id, slug, name, type, role }].
const peopleOf = async (videoId) => {
    const rows = await VideoPerson.findAll({ where: { video_id: videoId }, order: [['id', 'ASC']] });
    const links = await pageLinks(rows.map((row) => row.user_id));
    return rows
        .filter((row) => links.has(Number(row.user_id)))
        .map((row) => ({ ...links.get(Number(row.user_id)), role: row.role }));
};

// A video's topics, in their order.
const topicsOf = async (videoId) => {
    const [rows] = await sequelize.query(
        `SELECT t.id, t.name, t.slug FROM journal_topic_video_mappings m JOIN journal_topics t ON t.id = m.topic_id
         WHERE m.video_id = :id AND t.is_active = 1 AND t.deleted_at IS NULL ORDER BY m.sort_order ASC, t.name ASC`,
        { replacements: { id: videoId } },
    );
    return rows.map((t) => ({ id: Number(t.id), name: t.name, slug: t.slug }));
};

// One published video: its card, description, embed and watch links, people, topics and four related videos (the
// newest of its series).
const getVideo = async (slug) => {
    const video = await Video.findOne({ where: { slug: String(slug), status: 'published' }, attributes: [...CARD, 'description', 'series_id'], include: [SERIES] });
    if (!video) throw ApiError.withCode(httpStatus.NOT_FOUND, 'Video not found.', 'NOT_FOUND');
    const relatedWhere = { status: 'published', id: { [Op.ne]: video.id }, ...(video.series_id && { series_id: video.series_id }) };
    const [people, topics, related] = await Promise.all([
        peopleOf(video.id),
        topicsOf(video.id),
        Video.findAll({ attributes: CARD, where: relatedWhere, include: [SERIES], order: NEWEST, limit: 4 }),
    ]);
    return {
        ...toCard(video),
        description: video.description,
        embed_url: `https://www.youtube.com/embed/${video.youtube_id}`,
        watch_url: `https://www.youtube.com/watch?v=${video.youtube_id}`,
        people,
        topics,
        related: related.map(toCard),
    };
};

// The active series in order, each with how many published videos it has.
const listSeries = async () => {
    const [rows] = await sequelize.query(
        `SELECT s.id, s.name, s.slug, s.sort_order, COUNT(v.id) AS video_count FROM video_series s
         LEFT JOIN videos v ON v.series_id = s.id AND v.status = 'published'
         WHERE s.is_active = 1 GROUP BY s.id ORDER BY s.sort_order ASC, s.name ASC`,
    );
    return rows.map((s) => ({ id: s.id, name: s.name, slug: s.slug, sort_order: s.sort_order, video_count: Number(s.video_count) }));
};

// The published videos an account appears in (profile pages), newest first.
const videosOfAccount = async (userId, query = {}) => {
    const people = await VideoPerson.findAll({ where: { user_id: userId }, attributes: ['video_id'] });
    if (!people.length) return EMPTY();
    return page({ status: 'published', id: people.map((p) => p.video_id) }, query);
};

// A topic's published videos, in the topic's order.
const videosOfTopic = async (topicId) => {
    const [rows] = await sequelize.query('SELECT video_id FROM journal_topic_video_mappings WHERE topic_id = :id ORDER BY sort_order ASC, id ASC', {
        replacements: { id: topicId },
    });
    if (!rows.length) return [];
    const ids = rows.map((row) => Number(row.video_id));
    const videos = await Video.findAll({ attributes: CARD, where: { status: 'published', id: ids }, include: [SERIES] });
    return videos.toSorted((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)).map(toCard);
};

module.exports = { listVideos, getVideo, listSeries, videosOfAccount, videosOfTopic, toCard, CARD, SERIES };
