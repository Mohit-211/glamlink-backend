const path = require('path');
const { invalid } = require('./cardFields');

// A card's profile image and gallery (photos and videos): what a create or edit request adds, keeps and removes,
// checked against the plan's limits (docs/access.md section 1).
//
// Files arrive as `profile_image`, `images`, `videos` with one `video_thumbnails` each. On an edit,
// `existing_image_ids` and `existing_video_ids` list the saved items to keep (absent: keep them all).
// Captions and the cover flag come as `new_images_gallery_meta` (one per new photo; the admin panel sends
// `gallery_meta`) and `existing_images_gallery_meta` (one per kept photo).

const MAX_VIDEO_BYTES = 21 * 1024 * 1024;

const isImage = (file) => (file.mimetype || '').startsWith('image/');
const isMp4 = (file) => file.mimetype === 'video/mp4' || /\.mp4$/i.test(file.originalname || '');

const jsonList = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    let parsed = Array.isArray(value) && value.length === 1 ? value[0] : value;
    if (typeof parsed === 'string') {
        try {
            parsed = JSON.parse(parsed);
        } catch {
            throw invalid('images', 'The gallery details must be JSON.');
        }
    }
    return Array.isArray(parsed) ? parsed : undefined;
};

const ids = (value) => {
    const list = jsonList(value);
    return list && new Set(list.map((id) => String(typeof id === 'object' && id ? id.id : id)));
};

const metaOf = (meta = {}) => ({
    caption: meta.caption ? String(meta.caption).trim().slice(0, 255) || null : null,
    is_thumbnail: meta.is_thumbnail === true || meta.is_thumbnail === 'true',
});

/**
 * @param files     req.files (multer)
 * @param body      the request body
 * @param existing  the card's saved gallery rows (an edit), [] for a new card
 * @param creating  a new card: the profile image and one gallery item are required
 * @param limits    { photos, videos } allowed on the card
 * @returns { profileImage, add, removeIds, update }: rows to create, ids to remove, kept rows to update
 */
const planMedia = ({ files = {}, body = {}, existing = [], creating, limits }) => {
    const profile = (files.profile_image || [])[0];
    if (profile && !isImage(profile)) throw invalid('profile_image', 'The profile image must be a photo.');
    if (creating && !profile) throw invalid('profile_image', 'Please upload Profile Image.');

    const newPhotos = files.images || [];
    const newVideos = files.videos || [];
    const thumbnails = files.video_thumbnails || [];
    if (newPhotos.some((file) => !isImage(file))) throw invalid('images', 'Gallery photos must be images.');
    if (newVideos.some((file) => !isMp4(file))) throw invalid('images', 'Only .mp4 videos are supported.');
    if (newVideos.some((file) => file.size > MAX_VIDEO_BYTES)) throw invalid('images', 'Videos must be under 21MB.');
    if (thumbnails.length < newVideos.length) throw invalid('images', 'Please upload a thumbnail for each video.');
    if (thumbnails.some((file) => !isImage(file))) throw invalid('images', 'A video thumbnail must be a photo.');

    const savedPhotos = existing.filter((row) => row.file_type !== 'video');
    const savedVideos = existing.filter((row) => row.file_type === 'video');
    const keepPhotoIds = ids(body.existing_image_ids);
    const keepVideoIds = ids(body.existing_video_ids);
    const keptPhotos = keepPhotoIds ? savedPhotos.filter((row) => keepPhotoIds.has(String(row.id))) : savedPhotos;
    const keptVideos = keepVideoIds ? savedVideos.filter((row) => keepVideoIds.has(String(row.id))) : savedVideos;

    // A card over a limit from before the limits keeps what it has, but cannot add more.
    const photos = keptPhotos.length + newPhotos.length;
    const videos = keptVideos.length + newVideos.length;
    if (photos > limits.photos && photos > savedPhotos.length) throw invalid('images', `Up to ${limits.photos} photos.`);
    if (videos > limits.videos && videos > savedVideos.length) throw invalid('images', `Up to ${limits.videos} video${limits.videos === 1 ? '' : 's'}.`);
    if (creating && photos + videos === 0) throw invalid('images', 'Please upload Gallery Images.');

    const newMeta = jsonList(body.new_images_gallery_meta) || jsonList(body.gallery_meta) || [];
    const keptMeta = jsonList(body.existing_images_gallery_meta);
    let order = Math.max(0, ...existing.map((row) => row.sort_order || 0));

    const add = [
        ...newPhotos.map((file, i) => ({
            file_type: 'image',
            file_name: path.basename(file.filename),
            file_uri: file.filename,
            file_size: String(file.size),
            thumbnail_uri: null,
            sort_order: ++order,
            ...metaOf(newMeta[i]),
        })),
        ...newVideos.map((file, i) => ({
            file_type: 'video',
            file_name: path.basename(file.filename),
            file_uri: file.filename,
            file_size: String(file.size),
            thumbnail_uri: thumbnails[i].filename,
            sort_order: ++order,
            caption: null,
            is_thumbnail: false,
        })),
    ];

    // Captions and the cover flag of kept photos, in the order of `existing_image_ids`.
    const update = [];
    if (keptMeta && keepPhotoIds) {
        [...keepPhotoIds].forEach((id, i) => {
            const row = keptPhotos.find((photo) => String(photo.id) === id);
            if (row && keptMeta[i]) update.push({ id: row.id, ...metaOf(keptMeta[i]) });
        });
    }

    // One cover photo at most: the first one marked.
    const covers = [...update.filter((u) => u.is_thumbnail).map((u) => u.id), ...add.filter((a) => a.is_thumbnail)];
    if (covers.length > 1) {
        let first = true;
        for (const item of [...update, ...add]) {
            if (item.is_thumbnail && !first) item.is_thumbnail = false;
            if (item.is_thumbnail) first = false;
        }
    }

    const removeIds = [
        ...savedPhotos.filter((row) => !keptPhotos.includes(row)),
        ...savedVideos.filter((row) => !keptVideos.includes(row)),
    ].map((row) => row.id);

    return { profileImage: profile ? profile.filename : undefined, add, removeIds, update };
};

module.exports = { planMedia };
