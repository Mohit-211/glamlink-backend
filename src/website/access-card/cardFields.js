const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const { sanitizeBio } = require('./cardBio');

// The Access card's fields: exactly the website's card form (docs/access.md section 1). A create or edit request
// (JSON, or multipart where lists arrive as JSON strings) is read into the card's columns plus its locations and
// hours, and checked the way the website form checks it. Anything else in the body is ignored.

const LIMITS = {
    name: 100,
    professional_title: 100,
    business_name: 150,
    email: 255,
    bio_text: 80,
    specialties: 5,
    specialty: 60,
    locations: 10,
    location_label: 100,
    hours: 14,
    hour_note: 255,
    links: 10,
    link_title: 100,
    important_info: 10,
    info_line: 200,
    social: 300,
    promotion: 500,
};
const SOCIAL_KEYS = ['instagram', 'instagram1', 'instagram2', 'tiktok', 'linkedin', 'youtube', 'facebook'];
const BOOKING_METHODS = ['GO_TO_BOOKING_LINK', 'CALL_TEXT', 'DM_INSTAGRAM'];
// Older labels for the booking methods, still in some stored cards and clients.
const BOOKING_LABELS = { 'go to booking link': 'GO_TO_BOOKING_LINK', 'call / text': 'CALL_TEXT', 'dm on instagram': 'DM_INSTAGRAM' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLOR = /^#[0-9a-f]{6}$/i;

// A 400 the form can show under the field it names (the website form's field keys).
const invalid = (field, message) => ApiError.withCode(httpStatus.BAD_REQUEST, message, 'INVALID_CARD', { field });

// Multipart sends every value as a string, and a repeated field as an array of strings.
const last = (v) => (Array.isArray(v) ? v[v.length - 1] : v);
const str = (v) => {
    const value = last(v);
    return value === undefined || value === null ? undefined : String(value).trim();
};
const bool = (v) => {
    const value = last(v);
    return value === true || value === 1 || value === 'true' || value === '1';
};
const parsed = (v, field) => {
    if (typeof v !== 'string') return v;
    if (!v.trim()) return undefined;
    try {
        return JSON.parse(v);
    } catch {
        throw invalid(field, `${field} must be JSON.`);
    }
};
const list = (v, field) => {
    const value = parsed(Array.isArray(v) && v.length === 1 && typeof v[0] === 'string' && v[0].trim().startsWith('[') ? v[0] : v, field);
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw invalid(field, `${field} must be a list.`);
    return value;
};
const limited = (value, max, field, label) => {
    if (value && value.length > max) throw invalid(field, `${label} can be at most ${max} characters.`);
    return value;
};

// A web link; "example.com" becomes "https://example.com". Empty clears it.
const webLink = (v, field) => {
    const value = str(v);
    if (!value) return null;
    const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
    let url;
    try {
        url = new URL(withScheme);
    } catch {
        throw invalid(field, 'Please enter a valid link.');
    }
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) throw invalid(field, 'Please enter a valid link.');
    return limited(withScheme, 1000, field, 'A link');
};

// The bio's visible text, as the editor counts it (tags removed, entities as one character).
const bioText = (html) => html.replace(/<[^>]*>/g, '').replace(/&(?:[a-z]+|#\d+);/gi, '_').trim();

const coordinate = (v, max) => {
    const value = Number(last(v));
    return v === undefined || v === null || v === '' || !Number.isFinite(value) || Math.abs(value) > max ? null : value;
};

const readLocations = (v) => {
    const rows = list(v, 'locations').map((loc, index) => {
        if (!loc || typeof loc !== 'object') throw invalid('locations', 'Each location needs its details.');
        // `exact` is how older admin forms wrote an exact address.
        const type = loc.location_type === 'exact' ? 'exact_address' : loc.location_type;
        if (!['exact_address', 'city_only'].includes(type)) throw invalid('locations', 'Choose an exact address or a city for each location.');
        const address = str(loc.address) || null;
        const city = str(loc.city) || null;
        const state = str(loc.state) || null;
        if (type === 'exact_address' && !address) throw invalid('locations', 'Enter the address of each location.');
        if (type === 'city_only' && (!city || !state)) throw invalid('locations', 'Choose the state and city of each location.');
        return {
            label: limited(str(loc.label) || `Location ${index + 1}`, LIMITS.location_label, 'locations', 'A location label'),
            location_type: type,
            address: limited(address, 255, 'locations', 'An address'),
            city: limited(city, 255, 'locations', 'A city'),
            state: limited(state, 255, 'locations', 'A state'),
            latitude: coordinate(loc.latitude, 90),
            longitude: coordinate(loc.longitude, 180),
            // The website form sends `isPrimary`, the admin panel `is_primary`.
            is_primary: bool(loc.is_primary ?? loc.isPrimary),
            sort_order: index + 1,
        };
    });
    if (rows.length > LIMITS.locations) throw invalid('locations', `Add at most ${LIMITS.locations} locations.`);
    // Exactly one primary location: the first one marked, otherwise the first.
    const primary = Math.max(0, rows.findIndex((row) => row.is_primary));
    rows.forEach((row, index) => {
        row.is_primary = index === primary;
    });
    return rows;
};

// Business hours are lines of free text ({ note }); older day/time rows are written as a line.
const readHours = (v) => {
    const notes = list(v, 'business_hour').map((h) => {
        if (typeof h === 'string') return h.trim();
        if (h && h.note) return String(h.note).trim();
        if (h && h.day) {
            const closed = h.closed === true || h.is_closed === true;
            const time = closed ? 'Closed' : [h.open_time, h.close_time].filter(Boolean).join(' - ');
            return [h.day, time].filter(Boolean).join(': ');
        }
        return '';
    }).filter(Boolean);
    if (notes.length > LIMITS.hours) throw invalid('business_hour', `Add at most ${LIMITS.hours} lines of business hours.`);
    return notes.map((note) => ({ note: limited(note, LIMITS.hour_note, 'business_hour', 'A line of business hours') }));
};

const readBookingMethods = (v) => {
    const methods = [];
    for (const item of list(v, 'preferred_booking_methods')) {
        const value = String(item).trim();
        const method = BOOKING_LABELS[value.toLowerCase()] || BOOKING_METHODS.find((m) => m.toLowerCase() === value.toLowerCase());
        if (!method) throw invalid('preferred_booking_methods', `Unknown booking method: ${value}.`);
        if (!methods.includes(method)) methods.push(method);
    }
    return methods;
};

const readSocialMedia = (v) => {
    const value = parsed(last(v), 'social_media');
    if (value === undefined || value === null) return {};
    if (typeof value !== 'object' || Array.isArray(value)) throw invalid('social_media', 'social_media must be an object.');
    const social = {};
    for (const key of SOCIAL_KEYS) {
        const handle = str(value[key]);
        if (handle) social[key] = limited(handle, LIMITS.social, key === 'instagram' ? 'instagram' : 'social_media', 'A social link');
    }
    return social;
};

const readLinks = (v, field) => {
    const links = list(v, field)
        .map((link) => (typeof link === 'string' ? { url: link } : link))
        .filter((link) => link && str(link.url));
    if (links.length > LIMITS.links) throw invalid(field, `Add at most ${LIMITS.links} links.`);
    return links;
};

const readOtherLinks = (v) =>
    readLinks(v, 'other_links').map((link) => ({
        title: limited(str(link.title) || null, LIMITS.link_title, 'other_links', 'A link title'),
        url: webLink(link.url, 'other_links'),
    }));

// Featured links; a new image is one of this request's `featured_link_images`, chosen by `image_index`.
const readFeaturedLinks = (v, files) => {
    const uploads = (files && files.featured_link_images) || [];
    const links = readLinks(v, 'featured_links').map((link, index) => {
        const imageIndex = link.image_index === undefined || link.image_index === null || link.image_index === '' ? null : Number(link.image_index);
        const upload = imageIndex === null ? null : uploads[imageIndex];
        const kept = str(link.image ?? link.thumbnail_url ?? link.image_url);
        return {
            title: limited(str(link.title) || null, LIMITS.link_title, 'featured_links', 'A link title'),
            url: webLink(link.url, 'featured_links'),
            image: upload ? upload.filename : kept && /^https?:\/\//i.test(kept) ? kept : null,
            sort_order: index + 1,
            is_featured: bool(link.is_featured),
        };
    });
    if (links.filter((link) => link.is_featured).length > 1) throw invalid('featured_links', 'Only one featured link can be selected.');
    return links;
};

const readTextList = (v, field, max, maxLength, label) => {
    const items = list(v, field)
        .map((item) => (typeof item === 'string' ? item : item && (item.name || item.title || item.value)))
        .map((item) => (item === undefined || item === null ? '' : String(item).trim()))
        .filter(Boolean);
    const unique = items.filter((item, i) => items.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === i);
    if (unique.length > max) throw invalid(field, `Add at most ${max} ${label}.`);
    unique.forEach((item) => limited(item, maxLength, field, `Each of the ${label}`));
    return unique;
};

const has = (body, key) => body[key] !== undefined;

// A stored JSON column (a string or already parsed); `fallback` when it is empty or unreadable.
const stored = (value, fallback) => {
    if (typeof value !== 'string') return value ?? fallback;
    try {
        return JSON.parse(value) ?? fallback;
    } catch {
        return value || fallback;
    }
};

/**
 * The card's columns and its locations and hours from a request body.
 * On a create (`current` null) every required field must be there. On an edit only the fields in the request
 * change and are checked, against the stored card `current`; the bio's length is checked only when it changes.
 * Returns { card, locations, hours }: `locations` and `hours` are undefined when the request leaves them alone.
 */
const readCard = (body = {}, { current = null, files } = {}) => {
    const creating = !current;
    const card = {};
    const required = (key, field, label) => {
        if (has(body, key) || creating) {
            const value = str(body[key]);
            if (!value) throw invalid(field, `Please enter your ${label}.`);
            return value;
        }
        return undefined;
    };
    const set = (key, value) => {
        if (value !== undefined) card[key] = value;
    };

    set('name', limited(required('name', 'name', 'Name'), LIMITS.name, 'name', 'Name'));
    set('professional_title', limited(required('professional_title', 'professional_title', 'Professional Title'), LIMITS.professional_title, 'professional_title', 'Professional Title'));
    set('business_name', limited(required('business_name', 'business_name', 'Business Name'), LIMITS.business_name, 'business_name', 'Business Name'));

    const email = required('email', 'email', 'Email');
    if (email !== undefined) {
        if (!EMAIL.test(email) || email.length > LIMITS.email) throw invalid('email', 'Please enter a valid Email address.');
        card.email = email;
    }

    if (has(body, 'is_phone_visible')) card.is_phone_visible = bool(body.is_phone_visible);
    else if (creating) card.is_phone_visible = true;
    if (has(body, 'phone')) card.phone = (str(body.phone) || '').replace(/\D/g, '') || null;
    if (has(body, 'phone') || has(body, 'is_phone_visible') || creating) {
        const visible = card.is_phone_visible ?? current?.is_phone_visible ?? true;
        const phone = 'phone' in card ? card.phone : current?.phone;
        if (visible && !phone) throw invalid('phone', 'Please enter your Phone Number.');
        // The format is checked when a phone is sent, so an older stored number does not block other edits.
        if ('phone' in card && phone && visible && !/^\d{10}$/.test(phone)) throw invalid('phone', 'Phone Number must contain exactly 10 digits.');
        if ('phone' in card && phone && phone.length > 15) throw invalid('phone', 'Phone Number is too long.');
    }

    if (has(body, 'bio') || creating) {
        const bio = sanitizeBio(str(body.bio) || '');
        if (!bioText(bio)) throw invalid('bio', 'Please enter your Bio.');
        const changed = creating || bio !== sanitizeBio(current.bio || '');
        if (changed && bioText(bio).length > LIMITS.bio_text) throw invalid('bio', `Bio can be at most ${LIMITS.bio_text} characters.`);
        card.bio = bio;
    }

    if (has(body, 'color_code')) {
        const color = str(body.color_code);
        if (color && !COLOR.test(color)) throw invalid('color_code', 'Pick a card color like #24BBCB.');
        card.color_code = color ? color.toUpperCase() : null;
    }

    if (has(body, 'specialties') || creating) {
        const specialties = readTextList(body.specialties, 'specialties', LIMITS.specialties, LIMITS.specialty, 'specialties');
        if (!specialties.length) throw invalid('specialties', 'Please add at least one Specialty.');
        card.specialties = specialties;
        // The directory groups cards by their first specialty.
        card.primary_specialty = specialties[0];
    }

    if (has(body, 'website')) card.website = webLink(body.website, 'website');
    if (has(body, 'booking_link')) card.booking_link = webLink(body.booking_link, 'booking_link');
    if (has(body, 'social_media')) card.social_media = readSocialMedia(body.social_media);
    if (has(body, 'other_links')) card.other_links = readOtherLinks(body.other_links);
    if (has(body, 'featured_links')) card.featured_links = readFeaturedLinks(body.featured_links, files);
    if (has(body, 'important_info')) card.important_info = readTextList(body.important_info, 'important_info', LIMITS.important_info, LIMITS.info_line, 'lines of important information');

    // The website form sends `preferred_booking_method`; `preferred_booking_methods` is accepted too.
    const methodsKey = has(body, 'preferred_booking_method') ? 'preferred_booking_method' : 'preferred_booking_methods';
    if (has(body, methodsKey) || creating) {
        const methods = readBookingMethods(body[methodsKey]);
        if (!methods.length) throw invalid('preferred_booking_methods', 'Please select Preferred Booking Method.');
        card.preferred_booking_method = JSON.stringify(methods);
    }
    // A booking link (or the website) for "Go to booking link", an Instagram handle for "DM on Instagram".
    if (['preferred_booking_method', 'preferred_booking_methods', 'booking_link', 'website', 'social_media'].some((key) => has(body, key)) || creating) {
        const value = (key) => (key in card ? card[key] : current?.[key]);
        const methods = [stored(value('preferred_booking_method'), [])].flat();
        const instagram = (stored(value('social_media'), {}) || {}).instagram;
        if (methods.includes('GO_TO_BOOKING_LINK') && !value('booking_link') && !value('website')) throw invalid('booking_link', 'Please enter a Booking Link or Website.');
        if (methods.includes('DM_INSTAGRAM') && !instagram) throw invalid('instagram', 'Please enter your Instagram handle.');
    }

    if (has(body, 'offer_promotion')) {
        card.offer_promotion = bool(body.offer_promotion);
        const details = has(body, 'promotion_details') ? str(body.promotion_details) || null : current?.promotion_details;
        if (card.offer_promotion && !details) throw invalid('promotion_details', 'Describe the special offer.');
        card.promotion_details = card.offer_promotion ? limited(details, LIMITS.promotion, 'promotion_details', 'The offer') : details || null;
    } else if (has(body, 'promotion_details')) {
        card.promotion_details = limited(str(body.promotion_details) || null, LIMITS.promotion, 'promotion_details', 'The offer');
    }

    let locations;
    if (has(body, 'locations') || creating) {
        locations = readLocations(body.locations);
        if (!locations.length) throw invalid('locations', 'Please add a Location.');
    }
    const hours = has(body, 'business_hour') ? readHours(body.business_hour) : creating ? [] : undefined;

    return { card, locations, hours };
};

module.exports = { readCard, invalid, LIMITS, BOOKING_METHODS };
