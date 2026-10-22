// Slugs for URLs and filters: lower case letters, digits and dashes ("What's New" is whats-new, "Nails + Makeup"
// is nails-makeup), the way the website writes them.
const slugify = require('slugify');

const toSlug = (text) => slugify(String(text ?? ''), { lower: true, strict: true, trim: true });

module.exports = { toSlug };
