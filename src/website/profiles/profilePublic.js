// What anyone sees of a page (GET /profiles, GET /profiles/:slug), built field by field: nothing reaches the public
// unless it is named here. Email and phone come only from the live card, as the card itself shows them (the phone
// only while its owner shows it); never the account's own.
const { publicLink } = require('../access-card');

const EMPTY = Object.freeze({ count: 0, rows: [] });

// JSON from a text column (raw queries return it as text), or the fallback.
const parseJson = (value, fallback) => {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
};

const SOCIAL_TITLES = { instagram: 'Instagram', tiktok: 'TikTok', linkedin: 'LinkedIn', youtube: 'YouTube', facebook: 'Facebook' };
const SOCIAL_URLS = {
    instagram: (handle) => `https://www.instagram.com/${handle}`,
    tiktok: (handle) => `https://www.tiktok.com/@${handle}`,
    linkedin: (handle) => `https://www.linkedin.com/in/${handle}`,
    youtube: (handle) => `https://www.youtube.com/@${handle}`,
    facebook: (handle) => `https://www.facebook.com/${handle}`,
};

// The card's social links ({ instagram: "@kate" or a link, … }) as [{ title, url }].
const socialFromCard = (value) =>
    Object.entries(parseJson(value, {}) || {})
        .map(([key, handle]) => {
            const platform = key.replace(/\d+$/, '');
            const text = typeof handle === 'string' ? handle.trim() : '';
            if (!text || !SOCIAL_TITLES[platform]) return null;
            const url = /^https?:\/\//i.test(text) ? text : SOCIAL_URLS[platform](text.replace(/^@/, ''));
            return { title: SOCIAL_TITLES[platform], url };
        })
        .filter(Boolean);

const toRow = (row) => ({
    id: Number(row.id),
    slug: row.slug,
    type: row.type,
    name: row.name || null,
    image: row.image || null,
    tagline: row.tagline || null,
    city: row.city || null,
    state: row.state || null,
    specialty: row.specialty || null,
    is_featured: Boolean(Number(row.is_featured)),
});

// The page: the row's fields and the page's own (falling back to the card's, then the account's), the card's link,
// and the content lists ({ count, rows }, the first few rows).
const toDetail = (row, { topics = [], products = EMPTY, journal = EMPTY, magazine = EMPTY, videos = EMPTY } = {}) => {
    const card = Boolean(row.card_id);
    const ownSocial = parseJson(row.page_social, null);
    const specialties = parseJson(row.card_specialties, []);
    return {
        ...toRow(row),
        cover_image: row.cover_image || null,
        about: row.page_about || row.card_bio || row.account_about || null,
        website: row.page_website || row.card_website || row.account_website || null,
        social: Array.isArray(ownSocial) ? ownSocial : socialFromCard(row.card_social),
        location: row.city || row.state ? { city: row.city || null, state: row.state || null } : null,
        specialties: Array.isArray(specialties) ? specialties.filter((s) => typeof s === 'string') : [],
        email: card ? row.card_email || null : null,
        phone: card && Number(row.is_phone_visible) ? row.card_phone || null : null,
        booking_link: card ? row.booking_link || null : null,
        access_card: card ? { slug: row.card_slug, url: publicLink(row.card_slug) } : null,
        topics,
        products,
        journal,
        magazine,
        videos,
    };
};

module.exports = { toRow, toDetail, parseJson, EMPTY };
