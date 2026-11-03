// What anyone sees of a page (GET /profiles, GET /profiles/:slug), built field by field: nothing reaches the public
// unless it is named here. Email and phone come only from the live card, as the card itself shows them (the phone
// only while its owner shows it); never the account's own.
const sanitizeHtml = require('sanitize-html');
const { publicLink } = require('../access-card');
const { categoryLabel, shippingLabel } = require('./quickInfo');

const EMPTY = Object.freeze({ count: 0, rows: [] });

const INTRO = 300;

// The hero's intro when the page has none (Nov 3): the card bio as plain text, at most 300 characters (cut at a word,
// with "…").
const introFrom = (html) => {
    if (typeof html !== 'string' || !html.trim()) return null;
    const words = sanitizeHtml(html.replace(/<\/(p|h[1-6]|li|blockquote|div)>|<br\s*\/?>/gi, ' '), { allowedTags: [], allowedAttributes: {} })
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ').trim();
    if (words.length <= INTRO) return words || null;
    const cut = words.slice(0, INTRO - 1);
    const space = cut.lastIndexOf(' ');
    return `${(space > INTRO / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
};

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

// A list's row. Since Nov 3: the page's category (a brand's key, a professional's specialty) with its label, its
// shipping key, and, when the list was asked from a point, the miles to the page (null without coordinates).
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
    category: row.category || null,
    category_label: categoryLabel(row.type, row.category),
    shipping: row.shipping || null,
    is_featured: Boolean(Number(row.is_featured)),
    ...(row.distance !== undefined && { distance_miles: row.distance === null ? null : Math.round(Number(row.distance) * 10) / 10 }),
});

// A directory listing's part of the page (an account whose page comes from its approved listing): its locations
// (an exact address only where the form gave one, with the business phone given for it), hours and photos.
const listingPart = (row) => {
    const locations = parseJson(row.listing_locations, []);
    const hours = parseJson(row.listing_hours, []);
    const gallery = parseJson(row.listing_gallery, []);
    return {
        id: Number(row.listing_id),
        locations: (Array.isArray(locations) ? locations : []).filter((l) => l && typeof l === 'object').map((l) => ({
            label: l.label || null,
            location_type: l.location_type || null,
            address: l.location_type === 'exact_address' ? l.address || null : null,
            city: l.city || null,
            state: l.state || null,
            business_name: l.business_name || null,
            phone: l.phone || null,
            is_primary: Boolean(l.is_primary),
        })),
        business_hours: (Array.isArray(hours) ? hours : []).map((h) => h?.note).filter((note) => typeof note === 'string'),
        gallery: (Array.isArray(gallery) ? gallery : []).map((g) => ({ url: g.url, caption: g.caption || '', is_thumbnail: Boolean(g.is_thumbnail) })),
    };
};

// The page: the row's fields and the page's own (falling back to the card's, the listing's, then the account's), the
// card's link, the listing's part, and the content lists ({ count, rows }, the first few rows). Since Nov 3: the intro
// (else the card bio as text), category and shipping with their labels, the cover (else the card gallery's cover
// photo), the About image (else the page's first photo, else that cover photo), Quick Info's lines from the lists, and
// the lists `media`, `education` and `podcast` (The Beauty Vault). The owner's view (pageView) loads no lists.
const toDetail = (row, {
    topics = [], products = EMPTY, journal = EMPTY, magazine = EMPTY, videos = EMPTY, media = EMPTY, education = EMPTY, podcast = EMPTY,
} = {}) => {
    const card = Boolean(row.card_id);
    const ownSocial = parseJson(row.page_social, null);
    const specialties = parseJson(row.card_specialties, null) ?? parseJson(row.listing_specialties, []);
    return {
        ...toRow(row),
        intro: row.page_intro || (card ? introFrom(row.card_bio) : null),
        category: row.page_category || null,
        category_label: categoryLabel(row.type, row.page_category),
        shipping: row.page_shipping || null,
        shipping_label: shippingLabel(row.page_shipping),
        cover_image: row.cover_image || row.card_cover || null,
        about_image: row.page_about_image || row.media_image || row.card_cover || null,
        quick_info: { has_education: education.count > 0, on_podcast: podcast.count > 0, in_journal: journal.count > 0 },
        about: row.page_about || row.card_bio || row.listing_bio || row.account_about || null,
        website: row.page_website || row.card_website || row.listing_website || row.account_website || null,
        social: Array.isArray(ownSocial) ? ownSocial : socialFromCard(card ? row.card_social : row.listing_social),
        location: row.city || row.state ? { city: row.city || null, state: row.state || null } : null,
        specialties: Array.isArray(specialties) ? specialties.filter((s) => typeof s === 'string') : [],
        email: card ? row.card_email || null : null,
        phone: card && Number(row.is_phone_visible) ? row.card_phone || null : null,
        booking_link: (card ? row.booking_link : row.listing_booking_link) || null,
        access_card: card ? { slug: row.card_slug, url: publicLink(row.card_slug) } : null,
        listing: row.listing_id ? listingPart(row) : null,
        topics,
        products,
        journal,
        magazine,
        videos,
        media,
        education,
        podcast,
    };
};

module.exports = { toRow, toDetail, parseJson, EMPTY };
