// The directory (Mohit, Oct 23): our own profiles first (live Access cards, and the applications admins approved for
// people with no card), then about 20 Google listings near the visitor, which their owners can claim through the apply
// form, prefilled from Google.
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const config = require('../../core/config/config');
const logger = require('../../core/logger');
const sequelize = require('../../core/db/central.db');
const { paging } = require('../../core/http/paging');
const { containing } = require('../../core/utils/like');
const { DirectoryApplication } = require('../../models');
const { places, geocoder, configured } = require('../../integrations/googlePlaces');
const { directoryProfilesSql } = require('../profiles');

const refuse = (field, message) => ApiError.withCode(httpStatus.BAD_REQUEST, message, 'INVALID_DIRECTORY_QUERY', { field });
const ci = (expr) => `(${expr}) COLLATE utf8mb4_unicode_ci`;

// --- Where the visitor is

const coordinate = (value, field, limit) => {
    if (value === undefined || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n) || Math.abs(n) > limit) throw refuse(field, `${field} is a coordinate.`);
    return n;
};

// The point to search around: lat and lng, or a place typed ("Las Vegas, NV", a ZIP) geocoded. Null without either.
const pointFrom = async (query) => {
    const latitude = coordinate(query.lat, 'lat', 90);
    const longitude = coordinate(query.lng, 'lng', 180);
    if ((latitude === null) !== (longitude === null)) throw refuse(latitude === null ? 'lat' : 'lng', 'Send lat and lng together.');
    if (latitude !== null) return { latitude, longitude };
    const place = String(query.location ?? '').trim();
    if (!place) return null;
    if (!configured()) throw ApiError.withCode(httpStatus.SERVICE_UNAVAILABLE, 'Searching by place is not set up (GOOGLE_API_KEY).', 'GOOGLE_NOT_CONFIGURED');
    const found = await geocoder.geocode(place).catch(() => null);
    if (!found) throw refuse('location', 'No such place.');
    return { latitude: found.latitude, longitude: found.longitude };
};

const rad = (deg) => (deg * Math.PI) / 180;

// Miles between two points (as the crow flies).
const miles = (from, to) => {
    const a = Math.sin(rad(to.latitude - from.latitude) / 2) ** 2
        + Math.cos(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.sin(rad(to.longitude - from.longitude) / 2) ** 2;
    return Math.round(3958.8 * 2 * Math.asin(Math.sqrt(a)) * 10) / 10;
};

// --- Our profiles

const LISTINGS = `SELECT 'listing' AS kind, a.id, NULL AS slug, ${ci('a.name')} AS name, ${ci('a.profile_image')} AS image,
    ${ci('a.professional_title')} AS tagline, ${ci('a.city')} AS city, ${ci('a.state')} AS state, ${ci('a.primary_specialty')} AS specialty,
    ${ci('a.specialties')} AS specialties, a.latitude, a.longitude FROM directory_applications a WHERE a.status = 'approved'`;
const DISTANCE = `3958.8 * 2 * ASIN(SQRT(POWER(SIN(RADIANS(:lat - d.latitude) / 2), 2)
    + COS(RADIANS(:lat)) * COS(RADIANS(d.latitude)) * POWER(SIN(RADIANS(:lng - d.longitude) / 2), 2)))`;

// GET /directory/search: our profiles, one page.
//   q  name, title, specialties; specialty  one specialty; city, state; lat & lng, or location (a place, geocoded):
//   nearest first, within radius (miles, 25 by default, at most 100); without a place, by name. page, limit.
const search = async (query = {}) => {
    const { limit, offset } = paging(query);
    const point = await pointFrom(query);
    const radius = Math.min(Number(query.radius) > 0 ? Number(query.radius) : 25, 100);
    const where = [];
    const replacements = { limit, offset };
    const q = String(query.q ?? '').trim();
    if (q) {
        where.push('(d.name LIKE :term OR d.tagline LIKE :term OR d.specialty LIKE :term OR d.specialties LIKE :term)');
        replacements.term = containing(q);
    }
    if (query.specialty) {
        where.push('(d.specialty = :specialty OR d.specialties LIKE :quoted)');
        replacements.specialty = String(query.specialty);
        replacements.quoted = containing(`"${query.specialty}"`);
    }
    if (query.city) {
        where.push('d.city = :city');
        replacements.city = String(query.city).trim();
    }
    if (query.state) {
        where.push('d.state = :state');
        replacements.state = String(query.state).trim();
    }
    if (point) Object.assign(replacements, { lat: point.latitude, lng: point.longitude, radius });
    const inner = `SELECT d.*, ${point ? DISTANCE : 'NULL'} AS distance FROM (${directoryProfilesSql()} UNION ALL ${LISTINGS}) d
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;
    const outer = `FROM (${inner}) x ${point ? 'WHERE x.distance <= :radius' : ''}`;
    const [[{ count }]] = await sequelize.query(`SELECT COUNT(*) AS count ${outer}`, { replacements });
    const [rows] = await sequelize.query(
        `SELECT x.kind, x.id, x.slug, x.name, x.image, x.tagline, x.city, x.state, x.specialty, x.distance ${outer}
         ORDER BY ${point ? 'x.distance ASC, ' : ''}x.name ASC, x.kind ASC, x.id ASC LIMIT :limit OFFSET :offset`,
        { replacements },
    );
    return {
        count: Number(count),
        rows: rows.map((row) => ({
            kind: row.kind,
            id: Number(row.id),
            slug: row.slug,
            name: row.name,
            image: row.image,
            tagline: row.tagline,
            city: row.city,
            state: row.state,
            specialty: row.specialty,
            distance_miles: row.distance === null ? null : Math.round(Number(row.distance) * 10) / 10,
        })),
    };
};

const SOCIAL_TITLES = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', youtube: 'YouTube', linkedin: 'LinkedIn' };

// GET /directory/listings/:id: an approved application as the public sees it. Not shown: the applicant's own email
// and phone, the answers to Glamlink's questions, and the review.
const listing = async (id) => {
    const a = await DirectoryApplication.findOne({ where: { id, status: 'approved' } });
    if (!a) throw ApiError.withCode(httpStatus.NOT_FOUND, 'Listing not found.', 'NOT_FOUND');
    const social = Object.entries(a.social_media || {})
        .filter(([key, url]) => SOCIAL_TITLES[key] && typeof url === 'string' && /^https?:\/\//i.test(url.trim()))
        .map(([key, url]) => ({ title: SOCIAL_TITLES[key], url: url.trim() }));
    return {
        kind: 'listing',
        id: a.id,
        name: a.name,
        professional_title: a.professional_title,
        specialty: a.primary_specialty,
        specialties: Array.isArray(a.specialties) ? a.specialties.filter((s) => typeof s === 'string') : [],
        bio: a.bio,
        image: a.profile_image,
        gallery: (a.gallery || []).map((g) => ({ url: g.url, caption: g.caption, is_thumbnail: g.is_thumbnail })),
        website: a.website,
        booking_link: a.booking_link,
        preferred_booking_method: a.preferred_booking_method,
        social,
        locations: (Array.isArray(a.locations) ? a.locations : []).filter((l) => l && typeof l === 'object').map((l) => ({
            label: l.label || null,
            location_type: l.location_type || null,
            address: l.location_type === 'exact_address' ? l.address || null : null,
            city: l.city || null,
            state: l.state || null,
            business_name: l.business_name || null,
            phone: l.phone || null,
            is_primary: Boolean(l.is_primary),
        })),
        business_hours: (Array.isArray(a.business_hours) ? a.business_hours : []).map((h) => h?.note).filter((note) => typeof note === 'string'),
        offer: a.offer_promotion ? a.promotion_details : null,
        city: a.city,
        state: a.state,
    };
};

// --- Google's listings

const TYPE_WORDS = { esthetician: 'esthetician', 'med-spa': 'med spa', 'hair-stylist': 'hair salon' };
const notConfigured = () => ApiError.withCode(httpStatus.SERVICE_UNAVAILABLE, 'Google listings are not set up (GOOGLE_API_KEY).', 'GOOGLE_NOT_CONFIGURED');

// Google's answer, or 503 (no key) / 502 (Google failed).
const fromGoogle = async (call) => {
    if (!configured()) throw notConfigured();
    try {
        return await call();
    } catch (err) {
        logger.warn(`Google Places: ${err.message}`);
        throw ApiError.withCode(httpStatus.BAD_GATEWAY, 'Google did not answer. Try again in a moment.', 'GOOGLE_UNAVAILABLE');
    }
};

// Answers kept a while: each Google search costs money, and visitors in one area ask the same.
const cache = new Map();
const CACHE_MS = 6 * 60 * 60 * 1000;
const cached = async (key, make) => {
    const hit = cache.get(key);
    if (hit && hit.until > Date.now()) return hit.value;
    const value = await make();
    if (cache.size >= 500) cache.delete(cache.keys().next().value);
    cache.set(key, { value, until: Date.now() + CACHE_MS });
    return value;
};

// The place ids approved applications claimed.
const claimedPlaces = async (placeIds) => {
    if (!placeIds.length) return new Map();
    const rows = await DirectoryApplication.findAll({ where: { place_id: placeIds, status: 'approved' }, attributes: ['id', 'place_id'] });
    return new Map(rows.map((row) => [row.place_id, row.id]));
};

const photoUrl = (name, width = 400) =>
    name ? `${String(config.API_BASE_URL || '').replace(/\/+$/, '')}/api/v1/directory/google/photo?name=${encodeURIComponent(name)}&w=${width}` : null;

const publicPlace = (place, point) => ({
    place_id: place.place_id,
    name: place.name,
    address: place.address,
    city: place.city,
    state: place.state,
    rating: place.rating,
    review_count: place.review_count,
    photo_url: photoUrl(place.photo),
    maps_url: place.maps_url,
    website: place.website,
    type: place.type,
    distance_miles: point && place.latitude !== null ? miles(point, place) : null,
});

// GET /directory/google: up to 20 Google listings near the visitor (lat & lng, or location), by Google's relevance,
// for a type (esthetician, med-spa, hair-stylist) and words (q); listings already claimed through the directory are
// left out (they are among our profiles).
const googleListings = async (query = {}) => {
    const point = await pointFrom(query);
    if (!point) throw refuse('location', 'Send lat and lng, or a location.');
    if (query.type && !TYPE_WORDS[query.type]) throw refuse('type', `type is one of ${Object.keys(TYPE_WORDS).join(', ')}.`);
    const text = [String(query.q ?? '').trim().slice(0, 80), TYPE_WORDS[query.type] || 'beauty salon'].filter(Boolean).join(' ');
    const limit = Math.min(Number.parseInt(query.limit, 10) > 0 ? Number.parseInt(query.limit, 10) : 20, 20);
    const key = JSON.stringify([text, point.latitude.toFixed(2), point.longitude.toFixed(2)]);
    const found = await fromGoogle(() => cached(key, () => places.searchText({ text, latitude: point.latitude, longitude: point.longitude })));
    const claimed = await claimedPlaces(found.map((place) => place.place_id));
    const rows = found.filter((place) => !claimed.has(place.place_id) && place.open !== false).slice(0, limit).map((place) => publicPlace(place, point));
    return { count: rows.length, rows };
};

// GET /directory/google/search?q=: the apply form's "Find my business on Google": up to 5 matches for a business name
// and place.
const googleSearch = async (query = {}) => {
    const q = String(query.q ?? '').trim();
    if (q.length < 2 || q.length > 120) throw refuse('q', 'Search for 2 to 120 characters.');
    const found = await fromGoogle(() => cached(JSON.stringify(['search', q.toLowerCase()]), () => places.searchText({ text: q, limit: 5 })));
    const claimed = await claimedPlaces(found.map((place) => place.place_id));
    return found.slice(0, 5).map((place) => ({
        place_id: place.place_id,
        name: place.name,
        address: place.address,
        city: place.city,
        state: place.state,
        claimed: claimed.has(place.place_id),
    }));
};

// GET /directory/google/places/:placeId: a Google listing as the apply form's fields, to claim it (or start from it).
const googlePlace = async (placeId) => {
    if (!/^[\w-]{10,300}$/.test(String(placeId))) throw refuse('place_id', 'Not a Google place id.');
    const place = await fromGoogle(() => places.details(placeId));
    if (!place) throw ApiError.withCode(httpStatus.NOT_FOUND, 'Google has no such place.', 'NOT_FOUND');
    const claimed = await claimedPlaces([place.place_id]);
    return {
        place_id: place.place_id,
        claimed: claimed.has(place.place_id),
        form: {
            place_id: place.place_id,
            phone: place.phone,
            website: place.website,
            bio: place.summary,
            locations: [{
                label: place.name,
                location_type: 'exact_address',
                address: place.address,
                city: place.city,
                state: place.state,
                business_name: place.name,
                phone: place.phone,
                description: '',
                is_primary: true,
                sort_order: 1,
            }],
            business_hours: (place.hours || []).map((note) => ({ note })),
        },
        name: place.name,
        address: place.address,
        rating: place.rating,
        review_count: place.review_count,
        maps_url: place.maps_url,
        photos: (place.photos || []).map((name) => photoUrl(name, 800)),
    };
};

// GET /directory/google/photo?name=&w=: a Google listing's photo, by redirect to Google's own link (our key stays
// on the server).
const PHOTO_WIDTHS = [200, 400, 800, 1200];
const googlePhoto = async (query = {}) => {
    const name = String(query.name ?? '');
    if (!/^places\/[\w-]+\/photos\/[\w-]+$/.test(name)) throw refuse('name', 'Not a Google photo.');
    const asked = Number.parseInt(query.w, 10) || 400;
    const width = PHOTO_WIDTHS.find((w) => w >= asked) ?? PHOTO_WIDTHS.at(-1);
    const uri = await fromGoogle(() => cached(JSON.stringify(['photo', name, width]), () => places.photoUri(name, width)));
    if (!uri) throw ApiError.withCode(httpStatus.NOT_FOUND, 'No such photo.', 'NOT_FOUND');
    return uri;
};

// googleCache: for tests, which clear it between cases.
module.exports = { search, listing, googleListings, googleSearch, googlePlace, googlePhoto, googleCache: cache };
