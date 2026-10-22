// A card's public link and QR code, from its handle (the slug): <WEBSITE_URL>/access/<slug>.
const config = require('../../core/config/config');

const publicLink = (slug) => `${config.WEBSITE_URL}/access/${slug}`;
const qrUrl = (slug) => `${config.API_BASE_URL}/images/qr/${slug}.png`;
const slugOf = (link) => String(link || '').split('/access/')[1] || null;

module.exports = { publicLink, qrUrl, slugOf };
