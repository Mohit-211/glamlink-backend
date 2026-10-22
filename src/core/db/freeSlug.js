// Slugs a table's rows are found by (its `slug` column, one row each). Rows deleted softly keep theirs, so they count
// as taken.
const { Op } = require('sequelize');
const { toSlug } = require('../utils/slug');

// Whether a row other than `id` has the slug.
const slugTaken = async (Model, slug, id = null) =>
    Boolean(await Model.findOne({ where: { slug, ...(id && { id: { [Op.ne]: id } }) }, attributes: ['id'], paranoid: false }));

// A free slug made from a text: glow-up, then glow-up-2, ... `taken`: slugs given out in the same batch, not saved yet.
const freeSlug = async (Model, text, { id = null, max = 150, fallback = 'item', taken = new Set() } = {}) => {
    const base = toSlug(text).slice(0, max).replace(/-+$/, '') || fallback;
    for (let n = 1; ; n++) {
        const slug = n === 1 ? base : `${base}-${n}`;
        if (!taken.has(slug) && !(await slugTaken(Model, slug, id))) return slug;
    }
};

module.exports = { slugTaken, freeSlug };
