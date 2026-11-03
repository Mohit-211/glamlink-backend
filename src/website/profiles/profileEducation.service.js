// A page's Education (Mohit, Nov 3): videos (an MP4 uploaded here, or a YouTube or Vimeo link) and articles (text with
// links and images, and a cover), each with its own page (/profiles/<slug>/education/<item slug>; the slug comes from the
// title, unique per page, and changes only with the title). Shown on the owner's profile only, in the owner's order;
// they show at once, and drafts stay with their owner. Owners and admins edit alike: each function takes the account
// and `{ admin }`.
const { UniqueConstraintError } = require('sequelize');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const { paging } = require('../../core/http/paging');
const { wholeNumber } = require('../../core/utils/formValues');
const { freeSlug } = require('../../core/db/freeSlug');
const { ProfileEducation } = require('../../models');
const { refuse, text, image, empty } = require('./pageFields');
const { isImageFile, isMp4, onlyFiles, removeUnused } = require('./profileFiles');
const { embedUrl, videoLink } = require('./videoLinks');
const { sanitizeArticle } = require('./articleHtml');
const { ORDER, firstPlaces, saveOrder } = require('./itemOrder');

const KINDS = ['video', 'article'];
const STATUSES = ['draft', 'published'];
const LIMITS = { title: 150, summary: 300, body: 100000, slug: 120 };
const OWNER_PAGING = { defaultLimit: 12, maxLimit: 100 };

const notFound = () => ApiError.withCode(httpStatus.NOT_FOUND, 'Education item not found.', 'NOT_FOUND');

// A video item's video, as the website plays it; null for an article.
const videoOf = (item) => {
    if (item.kind !== 'video' || !item.video_url) return null;
    return {
        source: item.video_source,
        url: item.video_url,
        embed_url: embedUrl(item.video_source, item.video_id, item.video_url),
        thumbnail: item.video_thumbnail || null,
        duration_seconds: item.duration_seconds ?? null,
    };
};

// The cover lists show: the item's own, else a video's thumbnail.
const coverOf = (item) => item.cover_image || (item.kind === 'video' ? item.video_thumbnail || null : null);

// An item as lists show it (the page's Education section and its "View all").
const toCard = (item) => ({
    id: Number(item.id),
    slug: item.slug,
    kind: item.kind,
    title: item.title,
    summary: item.summary || null,
    cover_image: coverOf(item),
    video: videoOf(item),
    published_at: item.published_at || null,
});

// An item as its owner and admins see it, drafts too (`body` when one item is asked for).
const toOwner = (item, { body = false } = {}) => ({
    ...toCard(item),
    status: item.status,
    sort_order: item.sort_order,
    created_at: item.created_at,
    updated_at: item.updated_at,
    ...(body && { body: item.body || null }),
});

// An article's text, cleaned (articleHtml.js); null when nothing is left.
const articleBody = (value) => {
    if (empty(value)) return null;
    const html = sanitizeArticle(String(value));
    if (html.length > LIMITS.body) throw refuse('body', 'The article is too long.');
    return html || null;
};

const hasText = (html) => Boolean(html && html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()) || /<img\s/i.test(html || '');

// What a create or an edit sets (all of it on a create; an edit sends what changes), checked against the item as it
// will be. Form or JSON fields: kind, title, summary, status, body, video_url, cover_image (a link, "" clears it),
// duration_seconds; files: `images` (one, the cover), `videos` (one MP4) and `video_thumbnails` (its poster).
const itemFields = async (body = {}, files = {}, current = null) => {
    onlyFiles(files, ['images', 'videos', 'video_thumbnails']);
    const fields = {};
    if (!current || body.kind !== undefined) {
        if (!KINDS.includes(body.kind)) throw refuse('kind', 'kind is video or article.');
        fields.kind = body.kind;
    }
    if (!current || body.title !== undefined) {
        fields.title = text(body.title, 'title', LIMITS.title);
        if (!fields.title) throw refuse('title', 'title is required.');
    }
    if (body.summary !== undefined) fields.summary = text(body.summary, 'summary', LIMITS.summary);
    if (!empty(body.status)) {
        if (!STATUSES.includes(body.status)) throw refuse('status', 'status is draft or published.');
        fields.status = body.status;
    } else if (!current) fields.status = 'published';
    if (body.body !== undefined) fields.body = articleBody(body.body);
    if (body.duration_seconds !== undefined) {
        const seconds = empty(body.duration_seconds) ? null : wholeNumber(body.duration_seconds);
        if (!empty(body.duration_seconds) && (seconds === null || seconds < 0)) throw refuse('duration_seconds', 'duration_seconds is a whole number of seconds.');
        fields.duration_seconds = seconds;
    }

    const [cover, ...moreCovers] = files?.images || [];
    if (moreCovers.length) throw refuse('images', 'One cover image.');
    if (cover) {
        if (!isImageFile(cover)) throw refuse('cover_image', 'cover_image must be an image.');
        fields.cover_image = cover.filename;
    } else if (body.cover_image !== undefined && !(current && body.cover_image === coverOf(current))) {
        // (A form that sends back the cover it was shown, a video's thumbnail included, changes nothing.)
        fields.cover_image = image(body.cover_image, 'cover_image');
    }

    const [videoFile, ...moreVideos] = files?.videos || [];
    const [poster, ...morePosters] = files?.video_thumbnails || [];
    if (moreVideos.length || morePosters.length) throw refuse('videos', 'One video and its thumbnail.');
    if (videoFile && !empty(body.video_url)) throw refuse('video_url', 'Send a video link or a video file, not both.');
    if (poster && !isImageFile(poster)) throw refuse('video_thumbnails', 'A video thumbnail must be an image.');
    if (videoFile) {
        if (!isMp4(videoFile)) throw refuse('videos', 'Only .mp4 videos are supported.');
        Object.assign(fields, { video_source: 'upload', video_url: videoFile.filename, video_id: null, video_thumbnail: poster?.filename || null });
    } else if (!empty(body.video_url)) {
        if (poster) throw refuse('video_thumbnails', 'A thumbnail goes with a video file.');
        const link = await videoLink(body.video_url, 'video_url');
        Object.assign(fields, { video_source: link.source, video_url: link.url, video_id: link.video_id, video_thumbnail: link.thumbnail });
    } else if (poster) {
        if (current?.video_source !== 'upload') throw refuse('video_thumbnails', 'A thumbnail goes with a video file.');
        fields.video_thumbnail = poster.filename;
    }

    // What the item will be: a video needs its video; an article loses any video, and needs text to be published.
    const next = { ...(current ? current.get({ plain: true }) : {}), ...fields };
    if (next.kind === 'video' && !next.video_url) throw refuse('video_url', 'A video needs a YouTube or Vimeo link, or an MP4 file.');
    if (next.kind === 'article') {
        Object.assign(fields, { video_source: null, video_url: null, video_id: null, video_thumbnail: null });
        if (next.status === 'published' && !hasText(next.body)) throw refuse('body', 'Write the article before publishing it.');
    }
    return fields;
};

// A slug from the title, free among the page's items.
const slugFor = (userId, title, id = null) => freeSlug(ProfileEducation, title, { id, max: LIMITS.slug, fallback: 'post', scope: { user_id: userId } });

// Saves with a free slug, trying again if another request took the same one meanwhile.
const withSlug = async (save) => {
    for (let attempt = 1; ; attempt++) {
        try {
            return await save();
        } catch (error) {
            if (!(error instanceof UniqueConstraintError) || attempt >= 3) throw error;
        }
    }
};

const own = async (userId, id) => {
    const item = await ProfileEducation.findOne({ where: { id: wholeNumber(id), user_id: userId } });
    if (!item) throw notFound();
    return item;
};

// GET: the page's items, drafts too, in order (without their text); page, limit (12, at most 100).
const listOwn = async (userId, query = {}) => {
    const { limit, offset } = paging(query, OWNER_PAGING);
    const { count, rows } = await ProfileEducation.findAndCountAll({ where: { user_id: userId }, attributes: { exclude: ['body'] }, order: ORDER, limit, offset });
    return { count, rows: rows.map((item) => toOwner(item)) };
};

// GET :id: one item with its text.
const getOwn = async (userId, id) => toOwner(await own(userId, id), { body: true });

// POST: a new item (itemFields), first on the page. Published unless `status` is "draft". Answers the item.
const createItem = async (userId, body = {}, files = {}, { admin = false } = {}) => {
    const fields = await itemFields(body, files);
    const [place] = await firstPlaces(ProfileEducation, userId, 1);
    const item = await withSlug(async () => ProfileEducation.create({
        ...fields,
        user_id: userId,
        slug: await slugFor(userId, fields.title),
        published_at: fields.status === 'published' ? new Date() : null,
        sort_order: place,
        created_by_admin: admin,
    }));
    return toOwner(await item.reload(), { body: true });
};

// PUT :id: the fields sent (itemFields). A new title gives a new slug; the first publishing dates the item. The files
// it no longer uses are deleted, unless something else shows them. Answers the item.
const updateItem = async (userId, id, body = {}, files = {}) => {
    const item = await own(userId, id);
    const before = [item.cover_image, item.video_url, item.video_thumbnail];
    const fields = await itemFields(body, files, item);
    if (fields.status === 'published' && !item.published_at) fields.published_at = new Date();
    const retitled = fields.title !== undefined && fields.title !== item.title;
    await withSlug(async () => {
        if (retitled) fields.slug = await slugFor(userId, fields.title, item.id);
        await item.update(fields);
    });
    await removeUnused(before.filter((link) => link && ![item.cover_image, item.video_url, item.video_thumbnail].includes(link)));
    return toOwner(await item.reload(), { body: true });
};

// PUT order: { ids }, the page's whole order (drafts too).
const orderItems = (userId, body = {}) => saveOrder(ProfileEducation, userId, body.ids);

// DELETE :id, with the files only it uses.
const deleteItem = async (userId, id) => {
    const item = await own(userId, id);
    await item.destroy();
    await removeUnused([item.cover_image, item.video_url, item.video_thumbnail]);
    return { deleted: true };
};

// GET /profiles/:slug/education: the page's published items in order (`kind` video or article); page, limit (12, at
// most 50).
const publishedItems = async (userId, query = {}) => {
    const { limit, offset } = paging(query);
    const kind = KINDS.includes(query.kind) ? query.kind : null;
    const { count, rows } = await ProfileEducation.findAndCountAll({
        where: { user_id: userId, status: 'published', ...(kind && { kind }) }, attributes: { exclude: ['body'] }, order: ORDER, limit, offset,
    });
    return { count, rows: rows.map(toCard) };
};

// GET /profiles/:slug/education/:itemSlug: one published item, with its text and its page (`page` the page's row);
// 404 for a draft or an unknown slug.
const publishedItem = async (page, itemSlug) => {
    const item = await ProfileEducation.findOne({ where: { user_id: page.id, slug: String(itemSlug), status: 'published' } });
    if (!item) throw notFound();
    return {
        ...toCard(item),
        body: item.body || null,
        page: { slug: page.slug, name: page.name || null, type: page.type, image: page.image || null },
    };
};

module.exports = { listOwn, getOwn, createItem, updateItem, orderItems, deleteItem, publishedItems, publishedItem };
