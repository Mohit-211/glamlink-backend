const sanitizeHtml = require('sanitize-html');

// The card bio is rich text from the website's bio editor (Tiptap: paragraphs, bold, italic, underline, strike,
// an h3 heading, lists, quotes and links) and the website shows it as HTML, so it is cleaned with an allow-list
// on every save. Everything else goes: scripts, styles, event handlers, images, iframes, non-web link schemes.
const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h3', 'ul', 'ol', 'li', 'blockquote', 'a'];
const ALLOWED_ATTRIBUTES = { a: ['href', 'target', 'rel'] };
const ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel'];

const BIO_OPTIONS = {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ALLOWED_SCHEMES,
    allowProtocolRelative: false,
    transformTags: {
        // Links open in a new tab and pass on no referrer or ranking, as the editor writes them.
        a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer nofollow' }),
    },
};

const sanitizeBio = (html) => (typeof html === 'string' ? sanitizeHtml(html, BIO_OPTIONS).trim() : html);

// What cleaning takes out of a bio (tags, attributes, links with another scheme), e.g. ['<img>', 'p[style]'].
// Empty when cleaning changes only how the HTML is written, such as `&` becoming `&amp;`.
const bioMarkupRemoved = (html) => {
    const removed = new Set();
    if (typeof html !== 'string') return [];
    sanitizeHtml(html, {
        ...BIO_OPTIONS,
        onOpenTag: (tag, attribs) => {
            if (!ALLOWED_TAGS.includes(tag)) {
                removed.add(`<${tag}>`);
                return;
            }
            for (const name of Object.keys(attribs)) {
                if (!(ALLOWED_ATTRIBUTES[tag] || []).includes(name)) removed.add(`${tag}[${name}]`);
            }
            const scheme = tag === 'a' && /^\s*([a-z][a-z0-9+.-]*):/i.exec(attribs.href || '');
            if (scheme && !ALLOWED_SCHEMES.includes(scheme[1].toLowerCase())) removed.add(`a[href=${scheme[1]}:]`);
        },
    });
    return [...removed];
};

module.exports = { sanitizeBio, bioMarkupRemoved };
