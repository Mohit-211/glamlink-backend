// YouTube and Vimeo links on profile pages (Mohit, Nov 3: a video is an MP4 uploaded here or one of these): read to the
// video's id, a watch link of one form, the player link the website embeds, and a thumbnail (YouTube's needs no call;
// Vimeo's comes from its oEmbed, or is null).
const { videoIdFrom } = require('../../integrations/youtube');
const { vimeo } = require('../../integrations/vimeo');
const { refuse } = require('./pageFields');

const asUrl = (value) => {
    const text = String(value ?? '').trim();
    if (!text) return null;
    try {
        const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
        return ['http:', 'https:'].includes(url.protocol) ? url : null;
    } catch {
        return null;
    }
};

// { source, video_id, url } of a YouTube link (watch, youtu.be, shorts, embed, live) or a Vimeo link (vimeo.com/<id>,
// an unlisted video's vimeo.com/<id>/<hash>, channels, showcases, the player's link), else null.
const readVideoLink = (value) => {
    const url = asUrl(value);
    if (!url) return null;
    const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
    if (host === 'youtube.com' || host === 'youtu.be') {
        const id = videoIdFrom(url.href);
        return id ? { source: 'youtube', video_id: id, url: `https://www.youtube.com/watch?v=${id}` } : null;
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
        const parts = url.pathname.split('/').filter(Boolean);
        const at = parts.findLastIndex((part) => /^\d+$/.test(part));
        if (at < 0) return null;
        const hash = url.searchParams.get('h') || parts[at + 1];
        const unlisted = /^[\da-f]{6,}$/i.test(hash || '') ? `/${hash}` : '';
        return { source: 'vimeo', video_id: parts[at], url: `https://vimeo.com/${parts[at]}${unlisted}` };
    }
    return null;
};

// The player link for a YouTube or Vimeo video (an unlisted Vimeo video's hash is in its watch link); null otherwise.
const embedUrl = (source, videoId, watchUrl) => {
    if (!videoId) return null;
    if (source === 'youtube') return `https://www.youtube.com/embed/${videoId}`;
    if (source !== 'vimeo') return null;
    const hash = /vimeo\.com\/\d+\/([\da-f]+)$/i.exec(watchUrl || '')?.[1];
    return `https://player.vimeo.com/video/${videoId}${hash ? `?h=${hash}` : ''}`;
};

// A YouTube or Vimeo link as stored, with its thumbnail: { source, video_id, url, thumbnail }. Anything else is
// refused (400, `field` named).
const videoLink = async (value, field) => {
    const link = readVideoLink(value);
    if (!link) throw refuse(field, `${field} must be a YouTube or Vimeo link.`);
    const thumbnail = link.source === 'youtube' ? `https://i.ytimg.com/vi/${link.video_id}/hqdefault.jpg` : await vimeo.thumbnail(link.url);
    return { ...link, thumbnail };
};

module.exports = { readVideoLink, embedUrl, videoLink };
