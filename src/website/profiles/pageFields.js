// The fields set on a page, by its owner (PUT /my/profile) or an admin: checked and cleaned here. `about` is rich
// text cleaned like the card bio; images are uploads on the API host; `social` is a list of links. Admins also set
// the slug, whether the page is listed, and featuring. A refusal names the field (400 INVALID_PAGE).
const sanitizeHtml = require('sanitize-html');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const { isUploadedImage } = require('../../core/http/uploadedFiles');
const { isYes, wholeNumber } = require('../../core/utils/formValues');
const { toSlug } = require('../../core/utils/slug');
const { sanitizeBio } = require('../access-card');

const LIMITS = { tagline: 150, about: 2000, link: 500, socialTitle: 30, social: 10, slug: 60 };

const refuse = (field, message) => ApiError.withCode(httpStatus.BAD_REQUEST, message, 'INVALID_PAGE', { field });
const empty = (value) => value === null || value === undefined || (typeof value === 'string' && !value.trim());

const text = (value, field, max) => {
    if (empty(value)) return null;
    const out = String(value).trim();
    if (out.length > max) throw refuse(field, `${field} is at most ${max} characters.`);
    return out;
};

// A web link (http or https); "example.com" becomes https://example.com.
const webLink = (value, field) => {
    const raw = text(value, field, LIMITS.link);
    if (!raw) return null;
    const link = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
    let url;
    try {
        url = new URL(link);
    } catch {
        throw refuse(field, `${field} must be a web link.`);
    }
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.')) throw refuse(field, `${field} must be a web link.`);
    return link;
};

const about = (value) => {
    if (empty(value)) return null;
    const html = sanitizeBio(String(value));
    const words = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).trim();
    if (!words) return null;
    if (words.length > LIMITS.about) throw refuse('about', `about is at most ${LIMITS.about} characters of text.`);
    return html;
};

// [{ title, url }] (or that list as a JSON string, as forms send it). Empty means "use the card's links".
const socialLinks = (value) => {
    if (empty(value)) return null;
    let list = value;
    if (typeof list === 'string') {
        try {
            list = JSON.parse(list);
        } catch {
            throw refuse('social', 'social must be a list of { title, url }.');
        }
    }
    if (!Array.isArray(list)) throw refuse('social', 'social must be a list of { title, url }.');
    if (list.length > LIMITS.social) throw refuse('social', `At most ${LIMITS.social} social links.`);
    return list.map((item) => {
        if (!item || typeof item !== 'object') throw refuse('social', 'social must be a list of { title, url }.');
        const title = text(item.title, 'social', LIMITS.socialTitle);
        const url = webLink(item.url, 'social');
        if (!title || !url) throw refuse('social', 'Each social link needs a title and a url.');
        return { title, url };
    });
};

const image = (value, field) => {
    if (empty(value)) return null;
    if (!isUploadedImage(value)) throw refuse(field, `${field} must be an image uploaded to the API.`);
    return value;
};

// A slug from what an admin typed ("Kate Sue Beauty" -> kate-sue-beauty); whether it is free is checked by the caller.
const slug = (value) => {
    const out = toSlug(value);
    if (out.length < 3 || out.length > LIMITS.slug) throw refuse('slug', `slug is 3 to ${LIMITS.slug} letters, digits and dashes.`);
    return out;
};

const pageFields = (body, { admin = false } = {}) => {
    const fields = {};
    if (body.tagline !== undefined) fields.tagline = text(body.tagline, 'tagline', LIMITS.tagline);
    if (body.about !== undefined) fields.about = about(body.about);
    if (body.website !== undefined) fields.website = webLink(body.website, 'website');
    if (body.social !== undefined) fields.social = socialLinks(body.social);
    for (const field of ['image', 'cover_image']) if (body[field] !== undefined) fields[field] = image(body[field], field);
    if (admin) {
        if (body.slug !== undefined) fields.slug = slug(body.slug);
        if (body.is_listed !== undefined) fields.is_listed = isYes(body.is_listed);
        if (body.is_featured !== undefined) fields.is_featured = isYes(body.is_featured);
        if (body.featured_order !== undefined && body.featured_order !== '') {
            const order = wholeNumber(body.featured_order);
            if (order === null) throw refuse('featured_order', 'featured_order must be a whole number.');
            fields.featured_order = order;
        }
    }
    return fields;
};

module.exports = { pageFields, slug, refuse };
