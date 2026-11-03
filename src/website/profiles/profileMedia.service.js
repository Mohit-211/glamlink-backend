// A page's Media & Images (Mohit, Nov 3): photos and videos on every plan with no limit (the Access card's gallery keeps
// its plan's), shown in the owner's order. A video is an MP4 uploaded here or a YouTube or Vimeo link. Until the page
// has an item of its own that shows, it shows its live card's gallery instead (`source: "card"`); the first item added
// copies that gallery in first (once, `profile_pages.media_started_at`), so its photos stay on the page. Items show at
// once; admins also hide them. Owners and admins edit alike: each function takes the account and `{ admin }`.
const { Op, literal, UniqueConstraintError } = require('sequelize');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const sequelize = require('../../core/db/central.db');
const { paging } = require('../../core/http/paging');
const { isYes, wholeNumber } = require('../../core/utils/formValues');
const { ProfileMedia, ProfilePage, BusinessGalleryMedia } = require('../../models');
const { liveCardId } = require('./profileQuery');
const { refuse, text, empty, jsonList } = require('./pageFields');
const { isImageFile, isMp4, onlyFiles, imageSize, removeUnused } = require('./profileFiles');
const { embedUrl, videoLink } = require('./videoLinks');
const { ORDER, firstPlaces, nextPlace, saveOrder } = require('./itemOrder');

const KINDS = ['image', 'video'];
const PUBLIC_PAGING = { defaultLimit: 24, maxLimit: 60 };
const OWNER_PAGING = { defaultLimit: 24, maxLimit: 100 };
// The card's gallery as the card shows it: videos first, then its order.
const CARD_ORDER = [[literal("`file_type` = 'video'"), 'DESC'], ['sort_order', 'ASC'], ['id', 'ASC']];
const CAPTION = 255;

const notFound = () => ApiError.withCode(httpStatus.NOT_FOUND, 'Media not found.', 'NOT_FOUND');

// An item as the page shows it.
const toPublic = (item) => ({
    id: Number(item.id),
    kind: item.kind,
    source: item.source,
    url: item.url,
    thumbnail: item.thumbnail || null,
    embed_url: embedUrl(item.source, item.video_id, item.url),
    caption: item.caption || null,
    alt: item.alt || null,
    width: item.width ?? null,
    height: item.height ?? null,
});

// An item as its owner and admins see it: hidden or not, its place, and whether it was copied from the card.
const toOwner = (item) => ({
    ...toPublic(item),
    is_hidden: Boolean(item.is_hidden),
    sort_order: item.sort_order,
    from_card: item.card_media_id !== null && item.card_media_id !== undefined,
    created_at: item.created_at,
});

// An item of the card's gallery, shown while the page has none of its own (with the card item's id).
const fromCard = (item) => ({
    id: Number(item.id),
    kind: item.file_type === 'video' ? 'video' : 'image',
    source: 'card',
    url: item.file_uri,
    thumbnail: item.file_type === 'video' ? item.thumbnail_uri || null : null,
    embed_url: null,
    caption: item.caption || null,
    alt: null,
    width: null,
    height: null,
});

const cardKind = (kind) => {
    if (kind === 'video') return { file_type: 'video' };
    if (kind === 'image') return { [Op.or]: [{ file_type: { [Op.ne]: 'video' } }, { file_type: null }] };
    return {};
};

// What a page shows (GET /profiles/:slug and /profiles/:slug/media): its own items that show, in order, else its live
// card's gallery. `page` is the page's row (`id`, `card_id`); `kind` image or video; page, limit (24, at most 60).
const pageMedia = async (page, query = {}) => {
    const { limit, offset } = paging(query, PUBLIC_PAGING);
    const kind = KINDS.includes(query.kind) ? query.kind : null;
    if (await ProfileMedia.findOne({ where: { user_id: page.id, is_hidden: false }, attributes: ['id'] })) {
        const { count, rows } = await ProfileMedia.findAndCountAll({ where: { user_id: page.id, is_hidden: false, ...(kind && { kind }) }, order: ORDER, limit, offset });
        return { count, rows: rows.map(toPublic) };
    }
    if (!page.card_id) return { count: 0, rows: [] };
    const { count, rows } = await BusinessGalleryMedia.findAndCountAll({
        where: { business_card_id: page.card_id, file_uri: { [Op.ne]: null }, ...cardKind(kind) }, order: CARD_ORDER, limit, offset,
    });
    return { count, rows: rows.map(fromCard) };
};

// GET: the page's items, hidden ones too, in order; page, limit (24, at most 100).
const listOwn = async (userId, query = {}) => {
    const { limit, offset } = paging(query, OWNER_PAGING);
    const { count, rows } = await ProfileMedia.findAndCountAll({ where: { user_id: userId }, order: ORDER, limit, offset });
    return { count, rows: rows.map(toOwner) };
};

const own = async (userId, id) => {
    const item = await ProfileMedia.findOne({ where: { id: wholeNumber(id), user_id: userId } });
    if (!item) throw notFound();
    return item;
};

// Items just made, as stored (their dates as the database keeps them), in order.
const asStored = async (items) => (items.length ? ProfileMedia.findAll({ where: { id: items.map((item) => item.id) }, order: ORDER }) : []);

// Copies the live card's gallery items the page does not have yet (by the card item; a page holds each once), after the
// page's own items, in the card's order. Answers the items made.
const copyCardGallery = async (userId, { admin }) => {
    const cardId = await liveCardId(userId);
    if (!cardId) return [];
    const gallery = await BusinessGalleryMedia.findAll({ where: { business_card_id: cardId, file_uri: { [Op.ne]: null } }, order: CARD_ORDER });
    const copied = new Set((await ProfileMedia.findAll({ where: { user_id: userId, card_media_id: { [Op.ne]: null } }, attributes: ['card_media_id'] }))
        .map((item) => String(item.card_media_id)));
    let place = await nextPlace(ProfileMedia, userId);
    const items = [];
    for (const card of gallery.filter((g) => !copied.has(String(g.id)))) {
        const video = card.file_type === 'video';
        try {
            items.push(await ProfileMedia.create({
                user_id: userId,
                kind: video ? 'video' : 'image',
                source: 'upload',
                url: card.file_uri,
                thumbnail: video ? card.thumbnail_uri || null : null,
                caption: card.caption ? String(card.caption).trim().slice(0, CAPTION) || null : null,
                ...(video ? {} : await imageSize(card.file_uri)),
                card_media_id: card.id,
                sort_order: place++,
                created_by_admin: admin,
            }));
        } catch (error) {
            // Copied by another request meanwhile.
            if (!(error instanceof UniqueConstraintError)) throw error;
        }
    }
    return items;
};

// Marks the page's gallery as started (making its row if it has none): true for the request that does it first.
const markStarted = async (userId) => {
    await sequelize.query('INSERT IGNORE INTO profile_pages (user_id) VALUES (:userId)', { replacements: { userId } });
    const [changed] = await ProfilePage.update({ media_started_at: new Date() }, { where: { user_id: userId, media_started_at: null } });
    return changed > 0;
};

// POST import-card: copies the card's gallery items not on the page yet, after the page's own (the dashboard's "Import
// from my Access card"); an import that copies something starts the gallery. Answers { rows }, the items added.
const importCard = async (userId, { admin = false } = {}) => {
    const items = await copyCardGallery(userId, { admin });
    if (items.length) await markStarted(userId);
    return { rows: (await asStored(items)).map(toOwner) };
};

// The items a POST adds: photos (`images`, at most 20 a request) and MP4 videos (`videos`, with their posters in
// `video_thumbnails`: one each in the same order, or none), with `captions` (a JSON list: photos, then videos); or a
// YouTube or Vimeo link as JSON { url, caption?, alt? }.
const newItems = async (body = {}, files = {}) => {
    onlyFiles(files, ['images', 'videos', 'video_thumbnails']);
    const images = files?.images || [];
    const videos = files?.videos || [];
    const posters = files?.video_thumbnails || [];
    if (posters.length && posters.length !== videos.length) throw refuse('video_thumbnails', 'Send one thumbnail per video, in the same order, or none.');
    if (!images.length && !videos.length) {
        if (empty(body.url)) throw refuse('images', 'Add photos, videos or a YouTube or Vimeo link.');
        const link = await videoLink(body.url, 'url');
        return [{ kind: 'video', ...link, caption: text(body.caption, 'caption', CAPTION), alt: text(body.alt, 'alt', CAPTION) }];
    }
    if (!empty(body.url)) throw refuse('url', 'Send files or a link, not both.');
    if (images.some((file) => !isImageFile(file))) throw refuse('images', 'Photos must be images.');
    if (videos.some((file) => !isMp4(file))) throw refuse('videos', 'Only .mp4 videos are supported.');
    if (posters.some((file) => !isImageFile(file))) throw refuse('video_thumbnails', 'A video thumbnail must be an image.');
    const captions = jsonList(body.captions, 'captions') || [];
    if (captions.length > images.length + videos.length) throw refuse('captions', 'One caption per file at most.');
    if (captions.some((caption) => caption !== null && typeof caption !== 'string')) throw refuse('captions', 'Each caption is text.');
    const captionAt = (i) => text(captions[i], 'captions', CAPTION);
    const items = [];
    for (const [i, file] of images.entries()) {
        items.push({ kind: 'image', source: 'upload', url: file.filename, caption: captionAt(i), ...(await imageSize(file)) });
    }
    for (const [i, file] of videos.entries()) {
        items.push({ kind: 'video', source: 'upload', url: file.filename, thumbnail: posters[i]?.filename || null, caption: captionAt(images.length + i) });
    }
    return items;
};

// POST: adds photos, videos or a link (newItems). They go first on the page, in the order sent; the page's first add
// copies the card's gallery in before them. Answers { rows }, the items added.
const addMedia = async (userId, body = {}, files = {}, { admin = false } = {}) => {
    const items = await newItems(body, files);
    if (await markStarted(userId)) await copyCardGallery(userId, { admin });
    const places = await firstPlaces(ProfileMedia, userId, items.length);
    const rows = [];
    for (const [i, item] of items.entries()) {
        rows.push(await ProfileMedia.create({ ...item, user_id: userId, sort_order: places[i], created_by_admin: admin }));
    }
    return { rows: (await asStored(rows)).map(toOwner) };
};

// PUT :id: `caption` and `alt` ("" clears them); admins also `is_hidden`. Answers the item.
const updateMedia = async (userId, id, body = {}, { admin = false } = {}) => {
    const item = await own(userId, id);
    const fields = {};
    if (body.caption !== undefined) fields.caption = text(body.caption, 'caption', CAPTION);
    if (body.alt !== undefined) fields.alt = text(body.alt, 'alt', CAPTION);
    if (admin && body.is_hidden !== undefined) fields.is_hidden = isYes(body.is_hidden);
    await item.update(fields);
    return toOwner(item);
};

// PUT order: { ids }, the page's whole order (hidden items too).
const orderMedia = (userId, body = {}) => saveOrder(ProfileMedia, userId, body.ids);

// DELETE :id. The files the item owns go with it (its own upload, unless something else still shows it); a file copied
// from the card never does.
const deleteMedia = async (userId, id) => {
    const item = await own(userId, id);
    await item.destroy();
    if (item.source === 'upload' && item.card_media_id === null) await removeUnused([item.url, item.thumbnail]);
    return { deleted: true };
};

module.exports = { pageMedia, listOwn, addMedia, importCard, updateMedia, orderMedia, deleteMedia };
