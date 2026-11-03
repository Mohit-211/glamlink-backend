// The Shop page's sorting, price bands and saved products (Mohit, Nov 3): GET /discover/shop takes sort, min_price,
// max_price and ids (the visitor's saved products, kept in a cookie); GET /discover/shop/filters adds the range of
// prices (discover.service.js listShop, shopFilters).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');
const discoverService = require('../src/website/content/discover.service');

let app, q, insert, others;
const ids = {}; // products, by label

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    // Only this file's products are on sale while it runs (other tests add their own); after() puts theirs back.
    others = (await q('SELECT id FROM shops WHERE is_active = 1')).map((row) => row.id);
    if (others.length) await q('UPDATE shops SET is_active = 0 WHERE id IN (?)', [others]);
    const product = async (label, title, { price = null, sortOrder = 0, featured = 0, order = 0, created = '2026-01-01', status = 'published', active = 1 } = {}) => {
        ids[label] = await insert(
            `INSERT INTO shops (title, short_description, price, sort_order, is_featured, featured_order, status, is_active, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, `About ${title}`, price, sortOrder, featured, order, status, active, created],
        );
    };
    await product('amber', 'Amber Oil', { price: 29, sortOrder: 3, created: '2026-01-01' });
    await product('balm', 'Balm Duo', { price: 50, sortOrder: 1, featured: 1, order: 2, created: '2026-03-01' });
    await product('clay', 'Clay Mask', { price: 99.99, sortOrder: 2, featured: 1, order: 1, created: '2026-02-01' });
    await product('dew', 'Dew Mist', { price: 100, sortOrder: 2, created: '2026-03-01' });
    await product('eye', 'Eye Gel', { price: 180, created: '2026-04-01' });
    await product('face', 'Face Tool', { created: '2026-05-01' });
    await product('gift', 'Gift Card', { created: '2026-05-01' });
    // Two of one title, price and day.
    await product('hair1', 'Hair Clip', { price: 9.5, created: '2026-06-01' });
    await product('hair2', 'Hair Clip', { price: 9.5, created: '2026-06-01' });
    await product('mist', 'Mist', { price: 60, sortOrder: 4, created: '2026-01-15' });
    // A featured order left from when it was featured counts for nothing.
    await product('tonic', 'Mist Tonic', { price: 20, sortOrder: 4, order: -5, created: '2026-01-20' });
    await product('draft', 'Draft Lotion', { price: 5, status: 'draft' });
    await product('retired', 'Old Soap', { price: 1, active: 0 });
});
after(async () => {
    await q('DELETE FROM shops WHERE id IN (?)', [Object.values(ids)]);
    if (others.length) await q('UPDATE shops SET is_active = 1 WHERE id IN (?)', [others]);
    await app.close();
});

const shop = (query) => app.request('GET', `/api/v1/discover/shop?${query}`);
const list = async (query) => {
    const res = await shop(query);
    assert.equal(res.status, 200, res.body.message);
    return res.body.data;
};
const labelOf = (row) => Object.keys(ids).find((label) => ids[label] === Number(row.id));
const labels = (data) => data.rows.map(labelOf);
const refusal = (res) => [res.status, res.body.code, res.body.details];
// The products in a price band, cheapest first.
const band = async (query) => labels(await list(`limit=50&sort=price_asc&${query}`));
// The site search's products for "mist" (ranked), with these list parameters.
const ranked = (query) => discoverService.listShop({ search: 'mist', limit: 10, ...query }, { rank: true });
const filters = async () => (await app.request('GET', '/api/v1/discover/shop/filters')).body.data;
const PRICED = ['amber', 'balm', 'clay', 'dew', 'eye', 'hair1', 'hair2', 'mist', 'tonic'];

describe('GET /discover/shop: sorting (Nov 3)', () => {
    test('each sort, ending with the title, then the id; without one, the admins\' order as before', async () => {
        assert.deepEqual(labels(await list('limit=50')), ['eye', 'face', 'gift', 'hair1', 'hair2', 'balm', 'clay', 'dew', 'amber', 'mist', 'tonic']);
        assert.deepEqual(labels(await list('limit=50&sort=featured')), ['clay', 'balm', 'eye', 'face', 'gift', 'hair1', 'hair2', 'dew', 'amber', 'mist', 'tonic'],
            'featured ones in their order, then the admins\' order');
        assert.deepEqual(labels(await list('limit=50&sort=newest')), ['hair1', 'hair2', 'face', 'gift', 'eye', 'balm', 'dew', 'clay', 'tonic', 'mist', 'amber']);
        assert.deepEqual(labels(await list('limit=50&sort=price_asc')), ['hair1', 'hair2', 'tonic', 'amber', 'balm', 'mist', 'clay', 'dew', 'eye', 'face', 'gift'],
            'products without a price last');
        assert.deepEqual(labels(await list('limit=50&sort=price_desc')), ['eye', 'dew', 'clay', 'mist', 'balm', 'amber', 'tonic', 'hair1', 'hair2', 'face', 'gift'],
            'products without a price last here too');
        assert.deepEqual(labels(await list('limit=50&sort=name')), ['amber', 'balm', 'clay', 'dew', 'eye', 'face', 'gift', 'hair1', 'hair2', 'mist', 'tonic']);
        assert.deepEqual(labels(await list('sort=price_asc&limit=3&page=2')), ['amber', 'balm', 'mist'], 'paged');
    });

    test('featured=true keeps its featured order unless a sort is sent', async () => {
        assert.deepEqual(labels(await list('featured=true')), ['clay', 'balm']);
        assert.deepEqual(labels(await list('featured=true&sort=name')), ['balm', 'clay']);
    });

    test('another sort is refused', async () => {
        assert.deepEqual(refusal(await shop('sort=cheapest')), [400, 'INVALID_SHOP_QUERY', { field: 'sort' }]);
    });

    test('the site-wide search still ranks titles; a sort wins over the ranking', async () => {
        const res = await app.request('GET', '/api/v1/search?q=mist&type=products&limit=10');
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual(labels(res.body.data), ['mist', 'tonic', 'dew'], 'the exact title, then those starting with it');
        assert.deepEqual(labels(await ranked({})), ['mist', 'tonic', 'dew']);
        assert.deepEqual(labels(await ranked({ sort: 'price_asc' })), ['tonic', 'mist', 'dew']);
        assert.deepEqual(labels(await ranked({ sort: 'newest' })), ['dew', 'tonic', 'mist']);
    });
});

describe('GET /discover/shop: price bands (Nov 3)', () => {
    test('min_price is in the band and max_price is not, so 50 belongs to 50–100; products without a price drop out', async () => {
        assert.deepEqual(await band('max_price=50'), ['hair1', 'hair2', 'tonic', 'amber'], 'under 50, not the draft at 5');
        assert.deepEqual(await band('min_price=50&max_price=100'), ['balm', 'mist', 'clay']);
        assert.deepEqual(await band('min_price=100&max_price=150'), ['dew']);
        assert.deepEqual(await band('min_price=150'), ['eye']);
        assert.deepEqual(await band('min_price=0'), ['hair1', 'hair2', 'tonic', 'amber', 'balm', 'mist', 'clay', 'dew', 'eye'], 'every product with a price');
        assert.deepEqual(await band('min_price=99.99'), ['clay', 'dew', 'eye']);
        assert.deepEqual(await band('max_price=99.99'), ['hair1', 'hair2', 'tonic', 'amber', 'balm', 'mist']);
        assert.deepEqual(labels(await list('max_price=50&sort=price_desc')), ['amber', 'tonic', 'hair1', 'hair2']);
        assert.equal((await list('max_price=50')).count, 4, 'without a sort too');
    });

    test('a malformed price, or min_price not below max_price, is refused', async () => {
        for (const [query, field] of [
            ['min_price=abc', 'min_price'], ['min_price=-1', 'min_price'], ['min_price=1e3', 'min_price'], ['max_price=fifty', 'max_price'],
            ['max_price=0', 'max_price'], ['min_price=100&max_price=50', 'min_price'], ['min_price=50&max_price=50', 'min_price'],
        ]) {
            assert.deepEqual(refusal(await shop(query)), [400, 'INVALID_SHOP_QUERY', { field }], query);
        }
    });
});

describe('GET /discover/shop: saved products (Nov 3)', () => {
    test('only those published products, in the order of ids unless sorted', async () => {
        const saved = [ids.dew, ids.amber, ids.face, ids.draft, ids.retired, 999999].join(',');
        const data = await list(`ids=${saved}`);
        assert.deepEqual([data.count, labels(data)], [3, ['dew', 'amber', 'face']]);
        assert.deepEqual(labels(await list(`ids=${saved}&sort=price_asc`)), ['amber', 'dew', 'face']);
        assert.deepEqual(labels(await list(`ids=${saved}&limit=1&page=2`)), ['amber'], 'paged');
        assert.deepEqual(labels(await list(`ids=${saved}&max_price=50`)), ['amber'], 'with the other filters');
        assert.deepEqual(labels(await list(`ids=${ids.dew},${ids.amber},${ids.dew}`)), ['dew', 'amber'], 'an id twice counts once');
        assert.deepEqual(labels(await list(`ids=${encodeURIComponent(` ${ids.amber} , ${ids.dew} `)}`)), ['amber', 'dew']);
        assert.deepEqual(await list(`ids=${ids.draft},999999`), { count: 0, rows: [] }, 'nothing published');
    });

    test('an empty ids counts as not sent', async () => {
        assert.deepEqual(await list('ids='), await list(''), 'every product, as without parameters');
        assert.deepEqual(await list('ids=&limit=50'), await list('limit=50'));
    });

    test('at most 100 ids, each a positive whole number', async () => {
        const hundred = [ids.amber, ...Array.from({ length: 99 }, (_, i) => 900000 + i)];
        assert.deepEqual(labels(await list(`ids=${hundred.join(',')}`)), ['amber']);
        for (const value of [[...hundred, 900099].join(','), 'abc', `${ids.amber},,${ids.dew}`, '0', '-3', '1.5', `${ids.amber};${ids.dew}`, '99999999999999999999']) {
            assert.deepEqual(refusal(await shop(`ids=${encodeURIComponent(value)}`)), [400, 'INVALID_SHOP_QUERY', { field: 'ids' }], value.slice(0, 24));
        }
    });

    test('other kinds of discover items take none of these', async () => {
        const res = await app.request('GET', '/api/v1/discover/education?sort=cheapest&ids=abc&min_price=x');
        assert.equal(res.status, 200, res.body.message);
    });
});

describe('GET /discover/shop/filters: price (Nov 3)', () => {
    test('the lowest and highest price of the published products that have one, as numbers; null when none has', async () => {
        const priced = await filters();
        assert.deepEqual(Object.keys(priced), ['categories', 'brands', 'price']);
        assert.deepEqual(priced.price, { min: 9.5, max: 180 }, 'not the draft at 5 or the retired product at 1');
        const shown = PRICED.map((label) => ids[label]);
        await q('UPDATE shops SET is_active = 0 WHERE id IN (?)', [shown]);
        try {
            assert.equal((await filters()).price, null, 'only products without a price');
        } finally {
            await q('UPDATE shops SET is_active = 1 WHERE id IN (?)', [shown]);
        }
    });
});
