// Website products (Phase 6): GET /discover/shop pages products with category, brand, search and featured filters;
// GET /discover/shop/filters lists the filter values; a missing or unpublished product is 404
// (discover.service.js listShop, shopFilters, findDiscoverById; migration 20261023-0300).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const { toSlug } = require('../src/core/utils/slug');

let app, q, insert, auth, others;
const ids = {};

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    // Only this file's products are on sale while it runs (other tests add their own); after() puts theirs back.
    others = (await q('SELECT id FROM shops WHERE is_active = 1')).map((row) => row.id);
    if (others.length) await q('UPDATE shops SET is_active = 0 WHERE id IN (?)', [others]);
    const product = (title, { brand = null, category = null, sortOrder = 0, featured = 0, order = 0, status = 'published', active = 1 } = {}) =>
        insert(
            `INSERT INTO shops (title, short_description, description, brand, category, price, sort_order, is_featured, featured_order, status, is_active)
             VALUES (?, ?, ?, ?, ?, 19.99, ?, ?, ?, ?, ?)`,
            [title, `About ${title}`, `All about ${title}`, brand, category, sortOrder, featured, order, status, active],
        );
    ids.glow = await product('Glow Serum', { brand: 'SkinMedica', category: 'Serums', sortOrder: 2 });
    ids.tns = await product('TNS Advanced+ Serum', { brand: 'skinmedica ', category: 'serums', sortOrder: 1, featured: 1, order: 2 });
    ids.lash = await product('Lash Lift Kit', { brand: 'Lashify', category: 'Lash Care', featured: 1, order: 1 });
    ids.soap = await product('Plain Soap');
    ids.oil = await product('100% Pure Oil', { brand: 'Pure_Co', category: 'Oils' });
    ids.draft = await product('Draft Balm', { brand: 'Hidden', category: 'Balms', status: 'draft' });
    ids.inactive = await product('Retired Mask', { brand: 'Gone', category: 'Masks', active: 0 });

    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM')");
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Shop Admin', ?, 1, 1)", [`shop-admin-${Date.now()}@test.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
});
after(async () => {
    if (others.length) await q('UPDATE shops SET is_active = 1 WHERE id IN (?)', [others]);
    await app.close();
});

const list = async (query) => {
    const res = await app.request('GET', `/api/v1/discover/shop?${query}`);
    assert.equal(res.status, 200, res.body.message);
    return res.body.data;
};
const titles = (data) => data.rows.map((row) => row.title);

describe('GET /discover/shop', () => {
    test('without list parameters: every published product, by title, as before', async () => {
        const data = await list('');
        assert.deepEqual(titles(data), ['100% Pure Oil', 'Glow Serum', 'Lash Lift Kit', 'Plain Soap', 'TNS Advanced+ Serum']);
        assert.equal(data.count, 5);
    });

    test('pages products in the admins\' order, then by title, without the long description', async () => {
        const first = await list('page=1&limit=2');
        assert.equal(first.count, 5);
        assert.deepEqual(titles(first), ['100% Pure Oil', 'Lash Lift Kit']);
        assert.deepEqual(titles(await list('page=2&limit=2')), ['Plain Soap', 'TNS Advanced+ Serum']);
        assert.deepEqual(titles(await list('page=3&limit=2')), ['Glow Serum']);
        assert.equal(first.rows[0].description, undefined);
        assert.equal(first.rows[0].brand, 'Pure_Co', 'brand stays the text the website shows');
    });

    test('featured=true: the home row, in its order', async () => {
        assert.deepEqual(titles(await list('featured=true&limit=5')), ['Lash Lift Kit', 'TNS Advanced+ Serum']);
    });

    test('filters by category and brand slug (or name); spellings of one name count as one', async () => {
        assert.deepEqual(titles(await list('category=serums')), ['TNS Advanced+ Serum', 'Glow Serum']);
        assert.deepEqual(titles(await list('brand=skinmedica')), ['TNS Advanced+ Serum', 'Glow Serum']);
        assert.deepEqual(titles(await list('category=lash-care')), ['Lash Lift Kit']);
        assert.deepEqual(titles(await list('brand=Lashify&category=lash-care')), ['Lash Lift Kit']);
        assert.deepEqual(await list('category=balms'), { count: 0, rows: [] }, 'a draft\'s category is not a filter');
        assert.deepEqual(await list('brand=nobody'), { count: 0, rows: [] });
    });

    test('searches title, description, brand and category, taking % and _ literally', async () => {
        assert.deepEqual(titles(await list('search=lift')), ['Lash Lift Kit']);
        assert.deepEqual(titles(await list('search=About%20Plain')), ['Plain Soap']);
        assert.deepEqual(titles(await list('search=lashify')), ['Lash Lift Kit']);
        assert.deepEqual(titles(await list('search=100%25')), ['100% Pure Oil']);
        assert.deepEqual(titles(await list('search=_')), ['100% Pure Oil'], 'only the brand with an underscore');
    });
});

describe('GET /discover/shop/filters', () => {
    test('lists the categories and brands of published products with counts', async () => {
        const res = await app.request('GET', '/api/v1/discover/shop/filters');
        assert.equal(res.status, 200);
        const { categories, brands } = res.body.data;
        assert.deepEqual(categories.map((c) => [c.slug, c.count]), [['lash-care', 1], ['oils', 1], ['serums', 2]]);
        assert.deepEqual(brands.map((b) => [b.slug, b.count]), [['lashify', 1], [toSlug('Pure_Co'), 1], ['skinmedica', 2]]);
        assert.ok(categories.every((c) => typeof c.name === 'string' && c.name.trim() === c.name));
    });
});

describe('one product', () => {
    test('a published product, with its longer description', async () => {
        const res = await app.request('GET', `/api/v1/discover/shop/findById/${ids.glow}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.data.description, 'All about Glow Serum');
    });

    test('a missing, inactive or unpublished one is 404; an admin still opens a draft', async () => {
        for (const id of [999999, ids.inactive, ids.draft]) {
            const res = await app.request('GET', `/api/v1/discover/shop/findById/${id}`);
            assert.equal(res.status, 404, `product ${id}`);
            assert.equal(res.body.code, 'NOT_FOUND');
        }
        const draft = await app.request('GET', `/api/v1/discover/shop/findById/${ids.draft}`, { headers: auth });
        assert.equal(draft.status, 200);
        assert.equal(draft.body.data.title, 'Draft Balm');
    });
});

describe('admin', () => {
    test('features a product with an order and a description', async () => {
        const created = await app.request('POST', '/api/v1/discover/shop', {
            body: { title: 'Brow Gel', status: 'published', brand: 'Arch', is_featured: 'true', featured_order: '0', description: 'Holds all day' },
            headers: auth,
        });
        assert.equal(created.status, 201, created.body.message);
        assert.deepEqual(titles(await list('featured=true')), ['Brow Gel', 'Lash Lift Kit', 'TNS Advanced+ Serum']);

        const edit = (body) => app.request('PUT', `/api/v1/discover/shop/${created.body.data.id}`, { body, headers: auth });
        assert.equal((await edit({ featured_order: 'top' })).status, 400);
        assert.equal((await edit({ is_featured: 'false' })).status, 200);
        assert.deepEqual(titles(await list('featured=true')), ['Lash Lift Kit', 'TNS Advanced+ Serum']);
        const shown = await app.request('GET', `/api/v1/discover/shop/findById/${created.body.data.id}`);
        assert.equal(shown.body.data.description, 'Holds all day');
    });
});
