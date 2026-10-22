// Products with an owner and a brand (Phase 6): admins set them; products link to their owner's and brand's pages,
// the shop filters by them, and a professional's or brand's page lists its products (migration 20261023-0800).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');

let app, q, insert, auth;
const ids = {}; // accounts
const products = {};
const stamp = `${Date.now()}`.slice(-8);
const slugs = { brand: `skinmed${stamp}`, pro: `lashpro${stamp}`, hidden: `hiddenbrand${stamp}` };

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (6, 'User', 'USR'), (7, 'Professional', 'PRO'), (8, 'Brand', 'BRND')");
    const account = async (name, type, slug, { listed = true } = {}) => {
        const id = await insert(
            "INSERT INTO users (email, role_id, account_type, professional_type, status, is_active) VALUES (?, ?, 'professional', ?, 'ACCEPTED', 1)",
            [`${slug}@owners.example`, type === 'brand' ? 8 : 7, type],
        );
        await insert('INSERT INTO profiles (user_id, email, name) VALUES (?, ?, ?)', [id, `${slug}@owners.example`, name]);
        await insert("INSERT INTO business_cards (user_id, name, business_name, status, slug, business_card_link) VALUES (?, ?, ?, 'accepted', ?, ?)",
            [id, name, name, slug, `https://glamlink.net/access/${slug}`]);
        if (!listed) await insert('INSERT INTO profile_pages (user_id, is_listed) VALUES (?, 0)', [id]);
        return id;
    };
    ids.brand = await account(`SkinMed ${stamp}`, 'brand', slugs.brand);
    ids.pro = await account(`Lash Pro ${stamp}`, 'individual', slugs.pro);
    ids.hidden = await account(`Hidden Brand ${stamp}`, 'brand', slugs.hidden, { listed: false });
    ids.user = await insert("INSERT INTO users (email, role_id, account_type, status, is_active) VALUES (?, 6, 'user', 'ACCEPTED', 1)", [`user-${stamp}@owners.example`]);

    const product = (title, brand) => insert("INSERT INTO shops (title, brand, status) VALUES (?, ?, 'published')", [title, brand]);
    products.serum = await product(`Serum ${stamp}`, `SkinMed ${stamp}`);
    products.mask = await product(`Mask ${stamp}`, null);
    products.balm = await product(`Balm ${stamp}`, 'Other Co');
    products.wand = await product(`Wand ${stamp}`, null);
    products.hiddenOne = await product(`Hidden ${stamp}`, null);

    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Owners Admin', ?, 1, 1)", [`owners-admin-${stamp}@test.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
});
after(() => app.close());

const edit = (id, body) => app.request('PUT', `/api/v1/discover/shop/${id}`, { body, headers: auth });
const link = (id, slug, name) => ({ id, slug, name });
const mine = (rows) => rows.filter((row) => Object.values(products).includes(row.id));
const list = async (query) => {
    const res = await app.request('GET', `/api/v1/discover/shop?limit=50&${query}`);
    assert.equal(res.status, 200, res.body.message);
    return res.body.data;
};

describe('admins set owners and brands', () => {
    test('owner_id is a professional account, brand_id a brand account', async () => {
        assert.equal((await edit(products.mask, { brand_id: ids.brand, owner_id: ids.pro })).status, 200);
        assert.equal((await edit(products.balm, { brand_id: ids.brand })).status, 200);
        assert.equal((await edit(products.wand, { owner_id: ids.pro })).status, 200);
        assert.equal((await edit(products.hiddenOne, { brand_id: ids.hidden })).status, 200);
        for (const [body, field] of [[{ owner_id: ids.user }, 'owner_id'], [{ brand_id: ids.pro }, 'brand_id'], [{ brand_id: 99999999 }, 'brand_id']]) {
            const res = await edit(products.serum, body);
            assert.equal(res.status, 400, JSON.stringify(body));
            assert.equal(res.body.code, 'INVALID_PRODUCT');
            assert.deepEqual(res.body.details, { field });
        }
        assert.equal((await edit(products.wand, { owner_id: '' })).status, 200, 'cleared');
        assert.equal((await edit(products.wand, { owner_id: ids.pro })).status, 200);
    });
});

describe('products link to pages', () => {
    test('every product answer carries its owner and brand as { id, slug, name }, null without a visible page', async () => {
        const one = await app.request('GET', `/api/v1/discover/shop/findById/${products.mask}`);
        assert.deepEqual(one.body.data.brand_profile, link(ids.brand, slugs.brand, `SkinMed ${stamp}`));
        assert.deepEqual(one.body.data.owner, link(ids.pro, slugs.pro, `Lash Pro ${stamp}`));
        const all = mine((await app.request('GET', '/api/v1/discover/shop')).body.data.rows);
        assert.equal(all.find((row) => row.id === products.hiddenOne).brand_profile, null, 'an unlisted brand page is not linked');
        assert.equal(all.find((row) => row.id === products.serum).owner, null);
        assert.equal(all.find((row) => row.id === products.serum).brand, `SkinMed ${stamp}`, 'brand stays the text');
    });

    test('brand= takes a brand page\'s slug or a brand name\'s; owner= an owner\'s page', async () => {
        assert.deepEqual(mine((await list(`brand=${slugs.brand}`)).rows).map((r) => r.id).toSorted(), [products.mask, products.balm].toSorted());
        assert.deepEqual(mine((await list(`brand=skinmed-${stamp}`)).rows).map((r) => r.id), [products.serum], 'the name\'s slug');
        assert.deepEqual(mine((await list(`owner=${slugs.pro}`)).rows).map((r) => r.id).toSorted(), [products.mask, products.wand].toSorted());
        assert.deepEqual(await list(`owner=${slugs.hidden}`), { count: 0, rows: [] });
    });
});

describe('a page\'s products', () => {
    test('a page lists the products its account put up or makes, and pages the rest', async () => {
        const res = await app.request('GET', `/api/v1/profiles/${slugs.pro}`);
        assert.equal(res.status, 200, res.body.message);
        assert.equal(res.body.data.products.count, 2);
        assert.deepEqual(res.body.data.products.rows.map((r) => r.title).toSorted(), [`Mask ${stamp}`, `Wand ${stamp}`]);
        const brand = await app.request('GET', `/api/v1/profiles/${slugs.brand}`);
        assert.equal(brand.body.data.products.count, 2);

        const page = await app.request('GET', `/api/v1/profiles/${slugs.pro}/products?page=2&limit=1`);
        assert.equal(page.status, 200);
        assert.equal(page.body.data.count, 2);
        assert.equal(page.body.data.rows.length, 1);
        assert.equal((await app.request('GET', `/api/v1/profiles/${slugs.hidden}/products`)).status, 404);
    });
});
