// Links to files uploaded through this API: uploads.js stores each one as <API_BASE_URL>/<folder>/<file>.
const config = require('../config/config');

const base = () => (config.API_BASE_URL || '').replace(/\/+$/, '');

// An image uploaded here (an admin uploads one with POST /journal/upload, which answers its link as `location`).
// The website shows only images from the API's host.
const isUploadedImage = (url) =>
    typeof url === 'string' && Boolean(base()) && url.startsWith(`${base()}/images/`) && !url.includes('..');

module.exports = { isUploadedImage };
