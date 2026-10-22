// YouTube Data API v3, server side (YOUTUBE_API_KEY): a playlist's videos and a video's details, for the Watch videos
// (website/watch). The functions sit on one object so tests can replace them.
const config = require('../core/config/config');
const httpClient = require('../core/http/httpClient');

const API = 'https://www.googleapis.com/youtube/v3';

const configured = () => Boolean(config.YOUTUBE_API_KEY);

// Seconds in an ISO 8601 duration ("PT1H2M3S" is 3723); null when unreadable.
const seconds = (duration) => {
    const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(duration || ''));
    if (!m) return null;
    const [, d = 0, h = 0, min = 0, s = 0] = m.map((v) => Number(v || 0));
    return ((d * 24 + h) * 60 + min) * 60 + s;
};

// The largest thumbnail YouTube has for a video.
const bestThumbnail = (thumbnails = {}) =>
    (thumbnails.maxres || thumbnails.standard || thumbnails.high || thumbnails.medium || thumbnails.default || {}).url || null;

// The video id in a YouTube link (watch, youtu.be, shorts, embed, live) or an id on its own; null otherwise.
const videoIdFrom = (value) => {
    const text = String(value || '').trim();
    if (/^[\w-]{11}$/.test(text)) return text;
    let url;
    try {
        url = new URL(text);
    } catch {
        return null;
    }
    const host = url.hostname.replace(/^(www|m|music)\./, '');
    const id = host === 'youtu.be'
        ? url.pathname.split('/')[1]
        : host === 'youtube.com' && (url.searchParams.get('v') || url.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1]);
    return /^[\w-]{11}$/.test(id || '') ? id : null;
};

const youtube = {
    // The ids of a playlist's videos, newest first as YouTube lists them (paged 50 at a time).
    playlistVideoIds: async (playlistId) => {
        const ids = [];
        let pageToken;
        do {
            const { data } = await httpClient.get(`${API}/playlistItems`, {
                params: { part: 'contentDetails', maxResults: 50, playlistId, pageToken, key: config.YOUTUBE_API_KEY },
                timeout: 15000,
            });
            ids.push(...(data.items || []).map((item) => item.contentDetails?.videoId).filter(Boolean));
            pageToken = data.nextPageToken;
        } while (pageToken);
        return ids;
    },

    // Public videos' details, by id: [{ youtube_id, title, description, thumbnail, published_at, duration_seconds }].
    // Private, deleted and unlisted videos are left out.
    videoDetails: async (ids) => {
        const videos = [];
        for (let i = 0; i < ids.length; i += 50) {
            const { data } = await httpClient.get(`${API}/videos`, {
                params: { part: 'snippet,contentDetails,status', id: ids.slice(i, i + 50).join(','), key: config.YOUTUBE_API_KEY },
                timeout: 15000,
            });
            for (const item of data.items || []) {
                if (item.status?.privacyStatus !== 'public') continue;
                videos.push({
                    youtube_id: item.id,
                    title: item.snippet?.title || item.id,
                    description: item.snippet?.description || null,
                    thumbnail: bestThumbnail(item.snippet?.thumbnails),
                    published_at: item.snippet?.publishedAt ? new Date(item.snippet.publishedAt) : null,
                    duration_seconds: seconds(item.contentDetails?.duration),
                });
            }
        }
        return videos;
    },
};

module.exports = { youtube, configured, videoIdFrom, seconds };
