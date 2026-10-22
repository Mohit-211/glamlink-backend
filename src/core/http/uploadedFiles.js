// Links to files uploaded through this API: uploads.js stores each one as <API_BASE_URL>/<folder>/<file>.
const fs = require('fs');
const path = require('path');
const config = require('../config/config');
const { UPLOADS_DIR } = require('../config/paths');

const FOLDERS = ['images', 'videos', 'gifs', 'docs', 'audios', 'csv'];

const base = () => (config.API_BASE_URL || '').replace(/\/+$/, '');

// An image uploaded here (an admin uploads one with POST /journal/upload, which answers its link as `location`).
// The website shows only images from the API's host.
const isUploadedImage = (url) =>
    typeof url === 'string' && Boolean(base()) && url.startsWith(`${base()}/images/`) && !url.includes('..');

// Deletes the file behind an upload link, if it is one; anything else is left alone. Never throws.
const removeUploadedFile = (url) => {
    if (typeof url !== 'string' || !base() || !url.startsWith(`${base()}/`)) return;
    const [folder, file, ...rest] = url.slice(base().length + 1).split('/');
    if (!FOLDERS.includes(folder) || !file || rest.length || file !== path.basename(file) || file.startsWith('.')) return;
    fs.unlink(path.join(UPLOADS_DIR, folder, file), () => {});
};

module.exports = { isUploadedImage, removeUploadedFile };
