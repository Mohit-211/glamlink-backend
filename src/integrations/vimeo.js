// Vimeo's oEmbed (public, no key): a video's thumbnail, for the Vimeo links owners add to their profile pages
// (website/profiles). The function sits on an object so tests can replace it.
const httpClient = require('../core/http/httpClient');

const vimeo = {
    // The thumbnail of the video at this watch link, or null (a private video, a link Vimeo does not know, Vimeo not
    // answering). Never throws.
    thumbnail: async (url) => {
        try {
            const { data } = await httpClient.get('https://vimeo.com/api/oembed.json', { params: { url }, timeout: 5000 });
            return typeof data?.thumbnail_url === 'string' && data.thumbnail_url.startsWith('https://') ? data.thumbnail_url : null;
        } catch {
            return null;
        }
    },
};

module.exports = { vimeo };
