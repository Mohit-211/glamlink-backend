// Files on profile pages (Mohit, Nov 3): the photos and videos a request sends (through the global multer fields), a
// photo's size, an image for an education article's text, and deleting a file once nothing shows it any more.
const sharp = require('sharp');
const sequelize = require('../../core/db/central.db');
const { removeUploadedFile, uploadedFilePath } = require('../../core/http/uploadedFiles');
const { refuse } = require('./pageFields');

const isImageFile = (file) => (file?.mimetype || '').startsWith('image/');
const isMp4 = (file) => file?.mimetype === 'video/mp4' || /\.mp4$/i.test(file?.originalname || '');

// Refuses files sent under another field than these, which would otherwise stay on disk unused (a refused request's
// files are deleted).
const onlyFiles = (files, allowed) => {
    for (const [field, list] of Object.entries(files || {})) {
        if (list?.length && !allowed.includes(field)) throw refuse(field, `${field} is not taken here.`);
    }
};

const NO_SIZE = Object.freeze({ width: null, height: null });

// A photo's width and height as it shows (turned by its EXIF orientation), from a request's file or an upload link;
// nulls when it cannot be read.
const imageSize = async (fileOrLink) => {
    const file = typeof fileOrLink === 'string' ? uploadedFilePath(fileOrLink) : fileOrLink?.path;
    if (!file) return NO_SIZE;
    try {
        const { width, height, orientation } = await sharp(file).metadata();
        if (!width || !height) return NO_SIZE;
        return orientation >= 5 ? { width: height, height: width } : { width, height };
    } catch {
        return NO_SIZE;
    }
};

// Where an uploaded file can still be shown from: page media and education, the pages' own images, Access cards (whose
// gallery files are never deleted from here, even once the card's item is gone) and products.
const STILL_USED = `SELECT 1 FROM profile_media WHERE url = :url OR thumbnail = :url
    UNION ALL SELECT 1 FROM profile_education WHERE cover_image = :url OR video_url = :url OR video_thumbnail = :url
    UNION ALL SELECT 1 FROM profile_pages WHERE image = :url OR cover_image = :url OR about_image = :url
    UNION ALL SELECT 1 FROM business_gallery_media WHERE file_uri = :url OR thumbnail_uri = :url
    UNION ALL SELECT 1 FROM business_cards WHERE profile_image = :url
    UNION ALL SELECT 1 FROM shops WHERE cover_image = :url
    LIMIT 1`;

// Deletes the uploaded files behind these links that nothing uses any more (called once the item that had them is
// changed or gone). Links elsewhere (YouTube, Vimeo) are left alone.
const removeUnused = async (links) => {
    for (const url of new Set(links.filter((link) => uploadedFilePath(link)))) {
        const [rows] = await sequelize.query(STILL_USED, { replacements: { url } });
        if (!rows.length) removeUploadedFile(url);
    }
};

// POST /my/profile/uploads: one image (`images`) for an education article's text, answered as { location }, as the
// journal's editor uploads take it.
const uploadImage = (files = {}) => {
    onlyFiles(files, ['images']);
    const images = files?.images || [];
    if (images.length !== 1) throw refuse('images', 'Send one image.');
    if (!isImageFile(images[0])) throw refuse('images', 'The file must be an image.');
    return { location: images[0].filename };
};

module.exports = { isImageFile, isMp4, onlyFiles, imageSize, removeUnused, uploadImage };
