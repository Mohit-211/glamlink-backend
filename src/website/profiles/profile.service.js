// Public profile pages: GET /profiles (Find a Brand, the Industry page, the home rows) and GET /profiles/:slug, with a
// page's lists (products, articles, videos, issues; since Nov 3 its media and education).
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const sequelize = require('../../core/db/central.db');
const { paging } = require('../../core/http/paging');
const { isYes } = require('../../core/utils/formValues');
const { stateCode, stateName } = require('../../core/utils/usStates');
const { productsOfAccount, articlesOfAccount } = require('../content');
const { videosOfAccount } = require('../watch');
const { issuesOfAccount } = require('../magazine');
const { pageList, visiblePage, filterPages, pageSpecialties, SORTS, SPECIALTY_LENGTH } = require('./profileQuery');
const { toRow, toDetail } = require('./profilePublic');
const { BRAND_CATEGORIES, SHIPPING } = require('./quickInfo');
const { pageMedia } = require('./profileMedia.service');
const { publishedItems, publishedItem } = require('./profileEducation.service');

// How many rows of each list a page carries; "see all" pages the rest. Nov 3: 8 products for the carousel, 5 media,
// 3 education items and 1 Beauty Vault episode (`podcast`).
const FIRST_ROWS = { products: 8, journal: 3, videos: 4, magazine: 3, media: 5, education: 3, podcast: 1 };

// The podcast's series: the page's "Featured on The Beauty Vault".
const PODCAST_SERIES = 'beauty-vault-podcast';

const TYPES = ['brand', 'individual'];

// The farthest radius in miles (Nov 3, the Professionals and Brands pages).
const MAX_RADIUS = 500;

const notFound = () => ApiError.withCode(httpStatus.NOT_FOUND, 'Page not found.', 'NOT_FOUND');
const refuse = (field, message) => ApiError.withCode(httpStatus.BAD_REQUEST, message, 'INVALID_PROFILE_QUERY', { field });

// A query value as text, trimmed; null when empty.
const textOf = (value) => String(value ?? '').trim() || null;

// A coordinate, or null when not sent (read as the directory reads them).
const coordinate = (value, field, limit) => {
    if (value === undefined || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n) || Math.abs(n) > limit) throw refuse(field, `${field} is a coordinate.`);
    return n;
};

// A key of one of Quick Info's lists (in any case), or null when not sent.
const listKey = (list, value, field) => {
    const key = textOf(value)?.toLowerCase() ?? null;
    if (key !== null && !Object.hasOwn(list, key)) throw refuse(field, `${field} is one of ${Object.keys(list).join(', ')}.`);
    return key;
};

// The list's filters and order (Nov 3), each off unless sent; a value it cannot take is a 400 naming it.
const listFilters = (query) => {
    const sort = textOf(query.sort);
    if (sort !== null && !SORTS.includes(sort)) throw refuse('sort', `sort is one of ${SORTS.join(', ')}.`);
    const specialty = textOf(query.specialty);
    if (specialty !== null && [...specialty].length > SPECIALTY_LENGTH) throw refuse('specialty', `specialty is at most ${SPECIALTY_LENGTH} characters.`);
    const category = listKey(BRAND_CATEGORIES, query.category, 'category');
    const shipping = listKey(SHIPPING, query.shipping, 'shipping');
    const latitude = coordinate(query.lat, 'lat', 90);
    const longitude = coordinate(query.lng, 'lng', 180);
    if ((latitude === null) !== (longitude === null)) throw refuse(latitude === null ? 'lat' : 'lng', 'Send lat and lng together.');
    const point = latitude === null ? null : { latitude, longitude };
    let radius = null;
    if (textOf(query.radius) !== null) {
        radius = Number(query.radius);
        if (!Number.isFinite(radius) || radius <= 0 || radius > MAX_RADIUS) throw refuse('radius', `radius is more than 0 and at most ${MAX_RADIUS} miles.`);
        if (!point) throw refuse('radius', 'radius needs lat and lng.');
    }
    if (sort === 'nearest' && !point) throw refuse('sort', 'Sort by nearest needs lat and lng.');
    // A U.S. state matches written either way ("NV", "Nevada"); any other place as typed.
    const state = textOf(query.state);
    const code = stateCode(state);
    return {
        sort, specialty, category, shipping, point, radius,
        state: state && (code ? [code, stateName(code)] : [state]),
        city: textOf(query.city),
    };
};

// One page of pages, by name (featured=true: the featured ones in their order).
//   type  brand or individual; search  name, tagline, specialties, city, state; page, limit (12, at most 50).
//   Nov 3 (the Professionals and Brands pages; listFilters): sort (name, recommended, newest, nearest), specialty,
//   category, shipping, state, city, lat and lng (each row then has distance_miles), radius (miles from them).
const listProfiles = async (query = {}) => {
    const { limit, offset } = paging(query);
    const { count, rows } = await pageList({
        type: TYPES.includes(query.type) ? query.type : null,
        featured: isYes(query.featured),
        search: String(query.search ?? '').trim() || null,
        limit,
        offset,
        ...listFilters(query),
    });
    return { count, rows: rows.map(toRow) };
};

// Names in order: as people read them (case and accents aside), then capitals first, so of two spellings of one name
// "Las Vegas" comes before "las vegas".
const byName = (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }) || (a < b ? -1 : Number(a > b));

// Groups [{ key, name, id }] by key: { name, count, ids } each, named by its most used spelling (on a tie, the first by
// name) and counting a page once; by count, then name.
const grouped = (items) => {
    const groups = new Map();
    for (const { key, name, id } of items) {
        if (!groups.has(key)) groups.set(key, { ids: new Set(), spellings: new Map() });
        const group = groups.get(key);
        group.ids.add(id);
        if (!group.spellings.has(name)) group.spellings.set(name, new Set());
        group.spellings.get(name).add(id);
    }
    return [...groups.values()]
        .map(({ ids, spellings }) => ({
            name: [...spellings].toSorted(([a, x], [b, y]) => y.size - x.size || byName(a, b))[0][0],
            count: ids.size,
            ids,
        }))
        .toSorted((a, b) => b.count - a.count || byName(a.name, b.name));
};

// GET /directory/filters (website/directory, Nov 3): what the Professionals ('individual') or Brands ('brand') page
// filters the list by, each option with as many visible pages of that type as GET /profiles finds for it.
//   individual  specialties (each page's category, primary specialty and specialties, grouped as the `specialty`
//   filter compares them) and states with their cities (U.S. states by code, other places as written; pages without a
//   state left out). brand  every category and shipping option, in list order, zeros included.
const pageFilters = async (type) => {
    const pages = (await filterPages(type)).map((page) => ({ ...page, id: Number(page.id) }));
    if (type === 'brand') {
        const options = (list, field) => Object.entries(list).map(([key, label]) => ({
            key, label, count: pages.filter((page) => String(page[field] ?? '').trim().toLowerCase() === key).length,
        }));
        return { type, count: pages.length, categories: options(BRAND_CATEGORIES, 'category'), shipping: options(SHIPPING, 'shipping') };
    }
    const specialties = grouped((await pageSpecialties(type)).map((row) => ({ key: row.name_key, name: row.name, id: Number(row.id) })));
    const states = grouped(pages.filter((page) => page.state).map((page) => {
        const code = stateCode(page.state);
        return { key: code ? `code ${code}` : `text ${page.state_key}`, name: code ? stateName(code) : page.state, id: page.id };
    }));
    const cities = (ids) => grouped(pages.filter((page) => ids.has(page.id) && page.city).map((page) => ({ key: page.city_key, name: page.city, id: page.id })));
    return {
        type,
        count: pages.length,
        specialties: specialties.map(({ name, count }) => ({ name, count })),
        states: states.map(({ name, count, ids }) => ({
            code: stateCode(name),
            name,
            count,
            cities: cities(ids).map((city) => ({ name: city.name, count: city.count })),
        })),
    };
};

// The site-wide search's professionals or brands: { count, rows } of page rows, exact name matches first.
const searchPages = async ({ q, type, limit, offset }) => {
    const { count, rows } = await pageList({ type, search: q, limit, offset, ranked: true });
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
    const [topics, products, journal, videos, magazine, media, education, podcast] = await Promise.all([
        topicsOf(row.id),
        productsOfAccount(row.id, { limit: FIRST_ROWS.products }),
        articlesOfAccount(row.id, { limit: FIRST_ROWS.journal }),
        videosOfAccount(row.id, { limit: FIRST_ROWS.videos }),
        issuesOfAccount(row.id, { limit: FIRST_ROWS.magazine }),
        pageMedia(row, { limit: FIRST_ROWS.media }),
        publishedItems(row.id, { limit: FIRST_ROWS.education }),
        videosOfAccount(row.id, { series: PODCAST_SERIES, limit: FIRST_ROWS.podcast }),
    ]);
    return toDetail(row, { topics, products, journal, videos, magazine, media, education, podcast });
};

// GET /profiles/:slug/products: the products the account put up or makes, paged.
const profileProducts = async (slug, query = {}) => {
    const row = await visibleAccount(slug);
    return productsOfAccount(row.id, query);
};

// GET /profiles/:slug/articles: the articles that feature the account, newest first, paged.
const profileArticles = async (slug, query = {}) => {
    const row = await visibleAccount(slug);
    return articlesOfAccount(row.id, query);
};

// GET /profiles/:slug/videos: the videos the account appears in, newest first, paged; `series` one series' slug
// (beauty-vault-podcast: the page's podcast episodes).
const profileVideos = async (slug, query = {}) => {
    const row = await visibleAccount(slug);
    return videosOfAccount(row.id, query);
};

// GET /profiles/:slug/magazine: the issues the account appears in, newest first, paged.
const profileMagazine = async (slug, query = {}) => {
    const row = await visibleAccount(slug);
    return issuesOfAccount(row.id, query);
};

// GET /profiles/:slug/media: what the page's Media & Images shows (its own, else its card's gallery), in order, paged.
const profileMedia = async (slug, query = {}) => pageMedia(await visibleAccount(slug), query);

// GET /profiles/:slug/education: the page's published education items, in order, paged.
const profileEducation = async (slug, query = {}) => publishedItems((await visibleAccount(slug)).id, query);

// GET /profiles/:slug/education/:itemSlug: one published item with its text.
const profileEducationItem = async (slug, itemSlug) => publishedItem(await visibleAccount(slug), itemSlug);

module.exports = {
    listProfiles, pageFilters, searchPages, getProfile, profileProducts, profileArticles, profileVideos, profileMagazine, profileMedia,
    profileEducation, profileEducationItem, visibleAccount, topicsOf, notFound,
};
