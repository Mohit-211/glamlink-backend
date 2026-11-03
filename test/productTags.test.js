// Product tags, categories and the button label (Mohit, Nov 4): admins keep a list of tags (editorial ones are theirs to
// set), a product carries one; its category comes from a list of 8; its button has its own label. Every product row
// shows them, and the shop's filters list the 8 categories first (website/content: productTags.service.js,
// productForm.js; migration 20261104-0100).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');

let app, q, insert, auth, owner, others;
const tags = {}; // by name
const products = {}; // by label
const made = []; // tags this file adds
let seeded = [];
const stamp = `${Date.now()}`.slice(-8);
const ownerSlug = `zaratags${stamp}`;

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    // Only this file's products are on sale while it runs (other tests add their own); after() puts theirs back.
    others = (await q('SELECT id FROM shops WHERE is_active = 1')).map((row) => row.id);
    if (others.length) await q('UPDATE shops SET is_active = 0 WHERE id IN (?)', [others]);
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (7, 'Professional', 'PRO')");

    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Tags Admin', ?, 1, 1)", [`tags-admin-${stamp}@test.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };

    // A professional with a live card, so their products show on their page.
    owner = { email: `${ownerSlug}@tags.example` };
    owner.id = await insert(
        "INSERT INTO users (email, role_id, account_type, professional_type, status, is_active, email_verified_at, password) VALUES (?, 7, 'professional', 'individual', 'ACCEPTED', 1, NOW(), 'x')",
        [owner.email],
    );
    await insert('INSERT INTO profiles (user_id, email, name) VALUES (?, ?, ?)', [owner.id, owner.email, `Zara Tags ${stamp}`]);
    await insert("INSERT INTO business_cards (user_id, name, status, slug, business_card_link) VALUES (?, ?, 'accepted', ?, ?)",
        [owner.id, `Zara Tags ${stamp}`, ownerSlug, `https://glamlink.net/access/${ownerSlug}`]);
    const { createSession } = require('../src/shared/identity');
    owner.token = (await createSession({ id: owner.id }, { client: 'test' })).tokens.access_token;

    seeded = (await app.request('GET', '/api/v1/discover/shop/tags')).body.data;
    for (const tag of seeded) tags[tag.name] = tag;
});
after(async () => {
    const ids = Object.values(products);
    if (ids.length) await q('DELETE FROM shops WHERE id IN (?)', [ids]);
    if (made.length) await q('DELETE FROM product_tags WHERE id IN (?)', [made]);
    for (const [i, tag] of seeded.entries()) await q('UPDATE product_tags SET sort_order = ? WHERE id = ?', [i + 1, tag.id]);
    if (others.length) await q('UPDATE shops SET is_active = 1 WHERE id IN (?)', [others]);
    await app.close();
});

const api = (method, path, options) => app.request(method, `/api/v1${path}`, options);
const asAdmin = (method, path, body) => api(method, path, { body, headers: auth });
const asOwner = (method, path, body) => api(method, path, { body, token: owner.token });
const names = async () => (await api('GET', '/discover/shop/tags')).body.data.map((tag) => tag.name);
const refusal = (res) => [res.status, res.body.code, res.body.details];
const tagOf = (tag) => ({ id: tag.id, name: tag.name, is_editorial: tag.is_editorial });
// What a product row shows of the Nov 4 fields; a row by id.
const shown = (row) => ({ tag: row.tag, button_label: row.button_label, category: row.category });
const find = (rows, id) => rows.find((row) => row.id === id);

describe('product tags (Nov 4)', () => {
    test('the list is public: the first five, in order, editorial ones first', async () => {
        const res = await api('GET', '/discover/shop/tags');
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual(res.body.data.map((tag) => [tag.name, tag.is_editorial, tag.sort_order]), [
            ['Featured in The Beauty Vault', true, 1], ["Editor's Pick", true, 2], ['Pro Favorite', false, 3], ['New', false, 4], ['Best Seller', false, 5],
        ]);
        assert.deepEqual(Object.keys(res.body.data[0]), ['id', 'name', 'is_editorial', 'sort_order']);
    });

    test('admins add and rename tags; a name is 1 to 40 characters and unique in any case', async () => {
        assert.equal((await api('POST', '/discover/shop/tags', { body: { name: 'Nope' } })).status, 401);
        const added = await asAdmin('POST', '/discover/shop/tags', { name: ' Limited Edition ', is_editorial: 'true' });
        assert.equal(added.status, 201, added.body.message);
        assert.deepEqual({ ...added.body.data, id: 0 }, { id: 0, name: 'Limited Edition', is_editorial: true, sort_order: 6 }, 'trimmed, last in the order');
        made.push(added.body.data.id);
        const longest = await asAdmin('POST', '/discover/shop/tags', { name: 'x'.repeat(40) });
        assert.equal(longest.status, 201, longest.body.message);
        made.push(longest.body.data.id);

        assert.deepEqual(refusal(await asAdmin('POST', '/discover/shop/tags', { name: 'limited EDITION' })), [409, 'TAG_EXISTS', { field: 'name' }]);
        assert.deepEqual(refusal(await asAdmin('POST', '/discover/shop/tags', { name: '  ' })), [400, 'INVALID_TAG', { field: 'name' }]);
        assert.deepEqual(refusal(await asAdmin('POST', '/discover/shop/tags', { name: 'x'.repeat(41) })), [400, 'INVALID_TAG', { field: 'name' }]);

        const id = added.body.data.id;
        const renamed = await asAdmin('PUT', `/discover/shop/tags/${id}`, { name: 'Limited Run', is_editorial: false });
        assert.equal(renamed.status, 200, renamed.body.message);
        assert.deepEqual([renamed.body.data.name, renamed.body.data.is_editorial], ['Limited Run', false]);
        assert.equal((await asAdmin('PUT', `/discover/shop/tags/${id}`, { name: 'limited run' })).status, 200, 'its own name in another case');
        assert.deepEqual(refusal(await asAdmin('PUT', `/discover/shop/tags/${id}`, { name: 'NEW' })), [409, 'TAG_EXISTS', { field: 'name' }]);
        assert.equal((await asAdmin('PUT', '/discover/shop/tags/999999', { name: 'Ghost' })).status, 404);
        assert.equal((await api('PUT', `/discover/shop/tags/${id}`, { body: { name: 'Mine' } })).status, 401);
    });

    test('admins order the tags; any left out keep their order after those sent; an unknown id is refused', async () => {
        const start = (await api('GET', '/discover/shop/tags')).body.data;
        const ids = start.map((tag) => tag.id);
        const reversed = await asAdmin('PUT', '/discover/shop/tags/order', { ids: ids.toReversed() });
        assert.equal(reversed.status, 200, reversed.body.message);
        assert.deepEqual(reversed.body.data.map((tag) => tag.id), ids.toReversed());
        assert.deepEqual(await names(), start.map((tag) => tag.name).toReversed());
        assert.deepEqual((await api('GET', '/discover/shop/tags')).body.data.map((tag) => tag.sort_order), ids.map((_, i) => i + 1));

        const partial = await asAdmin('PUT', '/discover/shop/tags/order', { ids: [tags.New.id] });
        assert.deepEqual(partial.body.data.map((tag) => tag.id), [tags.New.id, ...ids.toReversed().filter((id) => id !== tags.New.id)]);
        assert.deepEqual(refusal(await asAdmin('PUT', '/discover/shop/tags/order', { ids: [tags.New.id, 999999] })), [400, 'INVALID_TAG', { field: 'ids' }]);
        assert.deepEqual(refusal(await asAdmin('PUT', '/discover/shop/tags/order', { ids: 'first' })), [400, 'INVALID_TAG', { field: 'ids' }]);
        assert.equal((await asAdmin('PUT', '/discover/shop/tags/order', { ids })).status, 200, 'back to the first order');
    });

    test('deleting a tag takes it off the products that carried it', async () => {
        const tag = (await asAdmin('POST', '/discover/shop/tags', { name: `Gone Soon ${stamp}` })).body.data;
        const product = async (label) => {
            const res = await asAdmin('POST', '/discover/shop', { title: `${label} ${stamp}`, status: 'published', tag_id: tag.id });
            assert.equal(res.status, 201, res.body.message);
            products[label] = res.body.data.id;
            return res.body.data;
        };
        assert.deepEqual((await product('Doomed Kit')).tag, tagOf(tag));
        await product('Doomed Gel');
        const res = await asAdmin('DELETE', `/discover/shop/tags/${tag.id}`);
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual(res.body.data, { id: tag.id, products_untagged: 2 });
        const kit = (await api('GET', `/discover/shop/findById/${products['Doomed Kit']}`)).body.data;
        assert.deepEqual([kit.tag_id, kit.tag], [null, null]);
        assert.ok(!(await names()).includes(`Gone Soon ${stamp}`));
        assert.equal((await asAdmin('DELETE', `/discover/shop/tags/${tag.id}`)).status, 404);
        assert.equal((await api('DELETE', `/discover/shop/tags/${tags.New.id}`)).status, 401);
    });
});

describe('product fields (Nov 4)', () => {
    test('admins: a category of the 8 by its label (any case) or slug, any tag, a button label of 30 characters at most', async () => {
        const created = await asAdmin('POST', '/discover/shop', {
            title: `Bath Kit ${stamp}`, status: 'published', category: 'body-bath', tag_id: tags["Editor's Pick"].id, button_label: ' Buy the kit ',
        });
        assert.equal(created.status, 201, created.body.message);
        products.bathKit = created.body.data.id;
        assert.deepEqual([created.body.data.category, created.body.data.tag, created.body.data.button_label],
            ['Body & Bath', tagOf(tags["Editor's Pick"]), 'Buy the kit']);

        const edit = (body) => asAdmin('PUT', `/discover/shop/${products.bathKit}`, body);
        const category = async (value) => (await edit({ category: value })).body.data.category;
        assert.equal(await category('WELLNESS & SUPPLEMENTS'), 'Wellness & Supplements');
        assert.equal(await category('wellness-supplements'), 'Wellness & Supplements');
        assert.equal(await category('devices-tools'), 'Devices & Tools');
        assert.equal(await category('body-and-bath'), 'Body & Bath', 'the slug as the shop\'s lists make it');
        assert.equal(await category('skincare'), 'Skincare');
        assert.equal(await category(''), null);
        assert.deepEqual(refusal(await edit({ category: 'Serums' })), [400, 'INVALID_PRODUCT', { field: 'category' }]);

        assert.deepEqual((await edit({ tag_id: tags.New.id })).body.data.tag, tagOf(tags.New));
        assert.equal((await edit({ tag_id: '' })).body.data.tag, null);
        assert.equal((await edit({ tag_id: tags['Pro Favorite'].id })).status, 200);
        assert.equal((await edit({ tag_id: null })).body.data.tag, null);
        for (const value of [999999, 'abc']) assert.deepEqual(refusal(await edit({ tag_id: value })), [400, 'INVALID_PRODUCT', { field: 'tag_id' }], String(value));

        assert.equal((await edit({ button_label: 'x'.repeat(30) })).body.data.button_label, 'x'.repeat(30));
        assert.deepEqual(refusal(await edit({ button_label: 'x'.repeat(31) })), [400, 'INVALID_PRODUCT', { field: 'button_label' }]);
        assert.equal((await edit({ button_label: '' })).body.data.button_label, null);
        const form = await app.form('PUT', `/api/v1/discover/shop/${products.bathKit}`, { fields: { category: 'Makeup', tag_id: '', button_label: 'Shop the look' }, headers: auth });
        assert.deepEqual([form.status, form.body.data.category, form.body.data.tag, form.body.data.button_label], [200, 'Makeup', null, 'Shop the look'], 'as form fields');
    });

    test('owners: the category and button label as admins; an open tag, never an editorial one', async () => {
        const created = await asOwner('POST', '/my/products', { title: `Lip Kit ${stamp}`, category: 'MAKEUP', tag_id: tags.New.id, button_label: 'Book a demo' });
        assert.equal(created.status, 201, created.body.message);
        products.lipKit = created.body.data.id;
        assert.deepEqual([created.body.data.category, created.body.data.tag, created.body.data.button_label], ['Makeup', tagOf(tags.New), 'Book a demo']);
        const edit = (body) => asOwner('PUT', `/my/products/${products.lipKit}`, body);
        assert.deepEqual(refusal(await edit({ category: 'Serums' })), [400, 'INVALID_PRODUCT', { field: 'category' }]);
        assert.deepEqual(refusal(await edit({ button_label: 'x'.repeat(31) })), [400, 'INVALID_PRODUCT', { field: 'button_label' }]);
        assert.equal((await edit({ tag_id: tags['Best Seller'].id })).body.data.tag.name, 'Best Seller', 'another open tag');
        assert.equal((await edit({ tag_id: '' })).body.data.tag, null, 'cleared');

        // An editorial tag: not on a new product, nor on one they edit.
        const editorial = tags['Featured in The Beauty Vault'];
        assert.deepEqual(refusal(await asOwner('POST', '/my/products', { title: `Vault Kit ${stamp}`, tag_id: editorial.id })), [403, 'TAG_ADMIN_ONLY', { field: 'tag_id' }]);
        assert.deepEqual(refusal(await edit({ tag_id: editorial.id })), [403, 'TAG_ADMIN_ONLY', { field: 'tag_id' }]);

        // Once an admin set one: not another tag, not cleared; the same id, or no tag_id, keeps it.
        assert.equal((await asAdmin('PUT', `/discover/shop/${products.lipKit}`, { tag_id: editorial.id })).status, 200);
        assert.deepEqual(refusal(await edit({ tag_id: tags.New.id })), [403, 'TAG_ADMIN_ONLY', { field: 'tag_id' }]);
        assert.deepEqual(refusal(await edit({ tag_id: '' })), [403, 'TAG_ADMIN_ONLY', { field: 'tag_id' }]);
        const same = await edit({ tag_id: editorial.id, title: `Lip Kit Pro ${stamp}` });
        assert.equal(same.status, 200, same.body.message);
        assert.deepEqual([same.body.data.title, same.body.data.tag], [`Lip Kit Pro ${stamp}`, tagOf(editorial)]);
        const other = await edit({ button_label: 'Try it' });
        assert.deepEqual([other.body.data.button_label, other.body.data.tag], ['Try it', tagOf(editorial)], 'other edits keep the tag');
        const form = await app.form('PUT', `/api/v1/my/products/${products.lipKit}`, { fields: { tag_id: String(editorial.id), category: 'nails' }, token: owner.token });
        assert.deepEqual([form.status, form.body.data.category], [200, 'Nails'], 'the same id as a form field');

        // Taken off by an admin, the product is theirs to tag again.
        assert.equal((await asAdmin('PUT', `/discover/shop/${products.lipKit}`, { tag_id: '' })).status, 200);
        assert.equal((await edit({ tag_id: tags.New.id })).body.data.tag.name, 'New');
    });

    test('every product row shows its tag, button label and category', async () => {
        await asAdmin('PUT', `/discover/shop/${products.lipKit}`, { tag_id: tags['Pro Favorite'].id, button_label: 'Try it', category: 'Makeup' });
        const plain = await asOwner('POST', '/my/products', { title: `Plain Brush ${stamp}` });
        products.plain = plain.body.data.id;
        const { slug } = (await api('GET', `/discover/shop/findById/${products.lipKit}`)).body.data;
        const expected = { tag: tagOf(tags['Pro Favorite']), button_label: 'Try it', category: 'Makeup' };
        const answers = {
            list: find((await api('GET', '/discover/shop?limit=50')).body.data.rows, products.lipKit),
            everything: find((await api('GET', '/discover/shop')).body.data.rows, products.lipKit),
            bySlug: (await api('GET', `/discover/shop/slug/${slug}`)).body.data,
            byId: (await api('GET', `/discover/shop/findById/${products.lipKit}`)).body.data,
            byIdForAdmins: (await api('GET', `/discover/shop/findById/${products.lipKit}`, { headers: auth })).body.data,
            page: find((await api('GET', `/profiles/${ownerSlug}`)).body.data.products.rows, products.lipKit),
            pageProducts: find((await api('GET', `/profiles/${ownerSlug}/products?limit=50`)).body.data.rows, products.lipKit),
            mine: find((await asOwner('GET', '/my/products?limit=50')).body.data.rows, products.lipKit),
            adminList: find((await asAdmin('GET', '/discover/shop/admin')).body.data.rows, products.lipKit),
            search: find((await api('GET', `/search?q=${encodeURIComponent(`Lip Kit Pro ${stamp}`)}&type=products`)).body.data.rows, products.lipKit),
        };
        for (const [where, row] of Object.entries(answers)) assert.deepEqual(row && shown(row), expected, where);
        const bare = find((await api('GET', '/discover/shop?limit=50')).body.data.rows, products.plain);
        assert.deepEqual(shown(bare), { tag: null, button_label: null, category: null });
    });
});

describe('the shop\'s categories (Nov 4)', () => {
    test('the filters list the 8 first, in order and with zeros, then the other categories stored; the list takes any spelling', async () => {
        products.legacy = await insert("INSERT INTO shops (title, category, status) VALUES (?, 'skincare ', 'published')", [`Old Toner ${stamp}`]);
        products.serums = await insert("INSERT INTO shops (title, category, status) VALUES (?, 'Serums', 'published')", [`Old Serum ${stamp}`]);
        await asAdmin('PUT', `/discover/shop/${products.bathKit}`, { category: 'Body & Bath' });
        const { categories } = (await api('GET', '/discover/shop/filters')).body.data;
        assert.deepEqual(categories.map((c) => [c.slug, c.name, c.count]), [
            ['skincare', 'Skincare', 1], ['haircare', 'Haircare', 0], ['makeup', 'Makeup', 1], ['nails', 'Nails', 0],
            ['body-and-bath', 'Body & Bath', 1], ['fragrance', 'Fragrance', 0], ['wellness-and-supplements', 'Wellness & Supplements', 0],
            ['devices-and-tools', 'Devices & Tools', 0], ['serums', 'Serums', 1],
        ]);
        const titles = async (category) => (await api('GET', `/discover/shop?limit=50&category=${encodeURIComponent(category)}`)).body.data.rows.map((row) => row.id);
        for (const spelling of ['body-and-bath', 'body-bath', 'Body & Bath']) assert.deepEqual(await titles(spelling), [products.bathKit], spelling);
        assert.deepEqual(await titles('Skincare'), [products.legacy], 'a value stored before, in another spelling');
        assert.deepEqual(await titles('serums'), [products.serums], 'another category, as before');
    });
});
