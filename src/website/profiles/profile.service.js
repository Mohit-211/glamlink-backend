// Public profile pages: GET /profiles (Find a Brand, the Industry page, the home rows) and GET /profiles/:slug.
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const sequelize = require('../../core/db/central.db');
const { paging } = require('../../core/http/paging');
const { isYes } = require('../../core/utils/formValues');
const { productsOfAccount } = require('../content');
const { pageList, visiblePage } = require('./profileQuery');
const { toRow, toDetail } = require('./profilePublic');

// How many rows of each list a page carries; "see all" pages the rest.
const FIRST_ROWS = { products: 4 };

const TYPES = ['brand', 'individual'];

const notFound = () => ApiError.withCode(httpStatus.NOT_FOUND, 'Page not found.', 'NOT_FOUND');

// One page of pages, by name (featured=true: the featured ones in their order).
//   type  brand or individual; search  name, tagline, specialties, city, state; page, limit (12, at most 50).
const listProfiles = async (query = {}) => {
    const { limit, offset } = paging(query);
    const { count, rows } = await pageList({
        type: TYPES.includes(query.type) ? query.type : null,
        featured: isYes(query.featured),
        search: String(query.search ?? '').trim() || null,
        limit,
        offset,
    });
    return { count, rows: rows.map(toRow) };
};

// The topics a professional is linked to (journal_topic_professional_mappings), in the admins' order.
const topicsOf = async (userId) => {
    const [rows] = await sequelize.query(
        `SELECT t.id, t.name, t.slug FROM journal_topic_professional_mappings m JOIN journal_topics t ON t.id = m.topic_id
         WHERE m.user_id = :id AND m.is_active = 1 AND m.deleted_at IS NULL AND t.is_active = 1 AND t.deleted_at IS NULL
         ORDER BY m.sort_order ASC, t.name ASC`,
        { replacements: { id: userId } },
    );
    return rows.map((t) => ({ id: Number(t.id), name: t.name, slug: t.slug }));
};

// The account behind a visible page's slug, or 404.
const visibleAccount = async (slug) => {
    const row = await visiblePage(slug);
    if (!row) throw notFound();
    return row;
};

// One page: what the page, its card and its account show, with its topics and the first rows of its content.
const getProfile = async (slug) => {
    const row = await visibleAccount(slug);
    const [topics, products] = await Promise.all([topicsOf(row.id), productsOfAccount(row.id, { limit: FIRST_ROWS.products })]);
    return toDetail(row, { topics, products });
};

// GET /profiles/:slug/products: the products the account put up or makes, paged.
const profileProducts = async (slug, query = {}) => {
    const row = await visibleAccount(slug);
    return productsOfAccount(row.id, query);
};

module.exports = { listProfiles, getProfile, profileProducts, visibleAccount, topicsOf, notFound };
