// The site-wide search (the home page's hero search, its results page): one call searches topics, professionals,
// brands, products, articles and videos, and answers each group's first rows with its count; `type` pages one group.
// Rows are the same light rows as each group's own list. Matching ignores case; exact matches come first, then words
// starting with the search, then words containing it. Searches are counted for admins (search_terms).
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const sequelize = require('../../core/db/central.db');
const { paging } = require('../../core/http/paging');
const { searchTopics, searchArticles, searchProducts } = require('../content');
const { searchPages } = require('../profiles');
const { searchVideos } = require('../watch');

const GROUPS = {
    topics: (options) => searchTopics(options),
    professionals: (options) => searchPages({ ...options, type: 'individual' }),
    brands: (options) => searchPages({ ...options, type: 'brand' }),
    products: (options) => searchProducts(options),
    articles: (options) => searchArticles(options),
    videos: (options) => searchVideos(options),
};
const MAX_PER_GROUP = 10;

const refuse = (message) => ApiError.withCode(httpStatus.BAD_REQUEST, message, 'INVALID_SEARCH', { field: 'q' });

const searchText = (value) => {
    const q = String(value ?? '').trim().replace(/\s+/g, ' ');
    if (q.length < 2) throw refuse('Search for at least 2 characters.');
    if (q.length > 100) throw refuse('Search for at most 100 characters.');
    return q;
};

// Counts a search, with how many rows it found in all.
const count = (term, results) =>
    sequelize.query(
        `INSERT INTO search_terms (term, searches, last_results, last_searched_at) VALUES (:term, 1, :results, NOW())
         ON DUPLICATE KEY UPDATE searches = searches + 1, last_results = :results, last_searched_at = NOW()`,
        { replacements: { term: term.toLowerCase(), results } },
    );

// GET /search?q=: every group's first `limit` rows (5, at most 10) with its count. With `type`, that group alone,
// paged (page, limit as other lists).
const search = async (query = {}) => {
    const q = searchText(query.q);
    if (query.type !== undefined) {
        if (!GROUPS[query.type]) throw ApiError.withCode(httpStatus.BAD_REQUEST, `type is one of ${Object.keys(GROUPS).join(', ')}.`, 'INVALID_SEARCH', { field: 'type' });
        const { limit, offset } = paging(query);
        return GROUPS[query.type]({ q, limit, offset });
    }
    const limit = Math.min(Number.parseInt(query.limit, 10) > 0 ? Number.parseInt(query.limit, 10) : 5, MAX_PER_GROUP);
    const names = Object.keys(GROUPS);
    const results = await Promise.all(names.map((name) => GROUPS[name]({ q, limit, offset: 0 })));
    const groups = Object.fromEntries(names.map((name, i) => [name, { count: results[i].count, rows: results[i].rows }]));
    await count(q, results.reduce((sum, r) => sum + r.count, 0));
    return groups;
};

// Admins: the most searched terms (sort=top), or the latest searches that found nothing (sort=empty).
const terms = async (query = {}) => {
    const { limit, offset } = paging(query, { defaultLimit: 50 });
    const empty = query.sort === 'empty';
    const [rows] = await sequelize.query(
        `SELECT term, searches, last_results, last_searched_at FROM search_terms ${empty ? 'WHERE last_results = 0' : ''}
         ORDER BY ${empty ? 'last_searched_at DESC' : 'searches DESC, last_searched_at DESC'} LIMIT :limit OFFSET :offset`,
        { replacements: { limit, offset } },
    );
    return rows.map((row) => ({ ...row, searches: Number(row.searches), last_results: Number(row.last_results) }));
};

module.exports = { search, terms };
