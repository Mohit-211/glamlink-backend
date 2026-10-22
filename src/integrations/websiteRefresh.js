// The website's cache-refresh hook (Phase 6, the website's requests): when data the website shows changes, the API
// tells it which, by tag ("journal", "profiles", ...), so it can keep pages cached for hours and still show changes
// within seconds: POST WEBSITE_REFRESH_URL { "tags": [...] } with "Authorization: Bearer <WEBSITE_REFRESH_SECRET>".
// Changes close together go in one call, a second after the first. A failed call is logged and dropped (the
// website's own expiry still applies). Off without the URL and the secret.
const config = require('../core/config/config');
const logger = require('../core/logger');
const httpClient = require('../core/http/httpClient');

const WAIT_MS = 1000;
let waiting = new Set();
let timer = null;

const configured = () => Boolean(config.WEBSITE_REFRESH_URL && config.WEBSITE_REFRESH_SECRET);

const send = async () => {
    const tags = [...waiting].toSorted();
    waiting = new Set();
    timer = null;
    try {
        await httpClient.post(config.WEBSITE_REFRESH_URL, { tags }, { headers: { Authorization: `Bearer ${config.WEBSITE_REFRESH_SECRET}` }, timeout: 5000 });
    } catch (err) {
        logger.warn(`Website refresh (${tags.join(', ')}): ${err.response ? `answered ${err.response.status}` : err.message}`);
    }
};

const refreshWebsite = (tags) => {
    if (!configured() || !tags.length) return;
    for (const tag of tags) waiting.add(tag);
    if (!timer) {
        timer = setTimeout(send, WAIT_MS);
        timer.unref();
    }
};

module.exports = { refreshWebsite, configured };
