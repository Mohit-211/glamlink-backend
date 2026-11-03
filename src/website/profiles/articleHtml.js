const sanitizeHtml = require('sanitize-html');
const { isUploadedImage } = require('../../core/http/uploadedFiles');

// An education article's text (Mohit, Nov 3: text, links and images inside) is HTML from the website's editor, and the
// website shows it as HTML, so it is cleaned with an allow-list on every save, as the card bio is, but richer: h2 and
// h3 headings, paragraphs and line breaks, bold, italic, lists, quotes, links over http or https (with
// rel="noopener noreferrer"; target only "_blank"), and images uploaded to this API (POST /my/profile/uploads).
// Everything else goes: scripts, styles, event handlers, iframes, images from elsewhere or data: links. Pasted h1 and
// h4-h6 headings become h2 and h3, b and i become strong and em.
const OPTIONS = {
    allowedTags: ['h2', 'h3', 'p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'blockquote', 'img'],
    allowedAttributes: { a: ['href', 'target', 'rel'], img: ['src', 'alt'] },
    allowedSchemes: ['http', 'https'],
    allowProtocolRelative: false,
    transformTags: {
        h1: 'h2',
        h4: 'h3',
        h5: 'h3',
        h6: 'h3',
        b: 'strong',
        i: 'em',
        a: (tagName, attribs) => ({
            tagName,
            attribs: {
                ...(typeof attribs.href === 'string' && { href: attribs.href }),
                ...(attribs.target === '_blank' && { target: '_blank' }),
                rel: 'noopener noreferrer',
            },
        }),
    },
    exclusiveFilter: (frame) => frame.tag === 'img' && !isUploadedImage(frame.attribs.src),
};

const sanitizeArticle = (html) => (typeof html === 'string' ? sanitizeHtml(html, OPTIONS).trim() : html);

module.exports = { sanitizeArticle };
