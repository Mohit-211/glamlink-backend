// Calls by slug (Phase 6, the website's requests): every article and product has a slug of its own, made from its
// title unless an admin gives one; GET /journal/slug/:slug and GET /discover/shop/slug/:slug find them by it, while
// the old calls by id keep working; a topic is found by its slug or its id (migration 20261023-1600).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const migration = require('../src/core/db/migrations/20261023-1600-slugs');

let app, q, insert, auth, authorId;
const stamp = `${Date.now()}`.slice(-8);

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (7, 'Professional', 'PRO')");
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Slug Admin', ?, 1, 1)", [`slugs-${stamp}@admin.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
    authorId = await insert("INSERT INTO authors (name) VALUES ('Slug Writer')");
});
after(() => app.close());

const newArticle = (body) => app.request('POST', '/api/v1/journal', { body: { author_id: authorId, content: '<p>Text</p>', status: 'published', ...body }, headers: auth });
const newProduct = (body) => app.request('POST', '/api/v1/discover/shop', { body: { status: 'published', ...body }, headers: auth });

describe('articles', () => {
    test('get a slug from their title, their own, unless an admin gives one; a taken one is refused', async () => {
        const first = await newArticle({ title: `Glow Guide ${stamp}` });
        assert.equal(first.status, 201, first.body.message);
        assert.equal(first.body.data.slug, `glow-guide-${stamp}`);
        const second = await newArticle({ title: `Glow Guide ${stamp}` });
        assert.equal(second.body.data.slug, `glow-guide-${stamp}-2`);
        const given = await newArticle({ title: 'Anything', slug: `Brow Basics ${stamp}` });
        assert.equal(given.body.data.slug, `brow-basics-${stamp}`);
        const taken = await newArticle({ title: 'Other', slug: `glow-guide-${stamp}` });
        assert.deepEqual([taken.status, taken.body.code, taken.body.details?.field], [400, 'INVALID_INPUT', 'slug']);
    });

    test('are found by slug, drafts only by admins; the call by id still answers', async () => {
        const created = (await newArticle({ title: `Lash Notes ${stamp}` })).body.data;
        const res = await app.request('GET', `/api/v1/journal/slug/lash-notes-${stamp}`);
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual([res.body.data.id, res.body.data.title], [created.id, `Lash Notes ${stamp}`]);
        assert.ok(Array.isArray(res.body.data.mentions));
        assert.equal((await app.request('GET', `/api/v1/journal/findJournalById/${created.id}`)).body.data.slug, `lash-notes-${stamp}`);

        const draft = (await newArticle({ title: `Draft Notes ${stamp}`, status: 'draft' })).body.data;
        assert.equal((await app.request('GET', `/api/v1/journal/slug/${draft.slug}`)).status, 404);
        assert.equal((await app.request('GET', `/api/v1/journal/slug/${draft.slug}`, { headers: auth })).status, 200);
        const missing = await app.request('GET', `/api/v1/journal/slug/no-such-article-${stamp}`);
        assert.deepEqual([missing.status, missing.body.code], [404, 'NOT_FOUND']);
    });

    test('keep their slug when renamed; an admin can change it, not to a taken one', async () => {
        const article = (await newArticle({ title: `Nail Art ${stamp}` })).body.data;
        const edit = (body) => app.request('PUT', `/api/v1/journal/${article.id}`, { body, headers: auth });
        await edit({ title: `Nail Art Today ${stamp}`, slug: '' });
        assert.equal((await q('SELECT slug FROM journals WHERE id = ?', [article.id]))[0].slug, `nail-art-${stamp}`);
        await edit({ slug: `Nails Now ${stamp}` });
        assert.equal((await q('SELECT slug FROM journals WHERE id = ?', [article.id]))[0].slug, `nails-now-${stamp}`);
        const taken = await edit({ slug: `glow-guide-${stamp}` });
        assert.deepEqual([taken.status, taken.body.details?.field], [400, 'slug']);
    });
});

describe('products', () => {
    test('get a slug from their title however they are added; admins can change it', async () => {
        const first = await newProduct({ title: `Glow Serum ${stamp}` });
        assert.equal(first.status, 201, first.body.message);
        assert.equal(first.body.data.slug, `glow-serum-${stamp}`);
        assert.equal((await newProduct({ title: `Glow Serum ${stamp}` })).body.data.slug, `glow-serum-${stamp}-2`);

        const { Shop } = require('../src/models');
        const twins = await Shop.bulkCreate([{ title: `Twin Balm ${stamp}` }, { title: `Twin Balm ${stamp}` }]);
        assert.deepEqual(twins.map((p) => p.slug), [`twin-balm-${stamp}`, `twin-balm-${stamp}-2`], 'a CSV upload too');

        const owner = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active) VALUES (?, 7, 'professional', 'individual', 'ACCEPTED', 1)", [`slugs-${stamp}@pro.example`]);
        const { createSession } = require('../src/shared/identity');
        const token = (await createSession({ id: owner }, { client: 'test' })).tokens.access_token;
        const mine = await app.request('POST', '/api/v1/my/products', { body: { title: `Own Oil ${stamp}` }, token });
        assert.equal(mine.body.data.slug, `own-oil-${stamp}`, 'an owner\'s too');

        const id = first.body.data.id;
        const edit = (body) => app.request('PUT', `/api/v1/discover/shop/${id}`, { body, headers: auth });
        await edit({ title: `Glow Serum Plus ${stamp}` });
        assert.equal((await q('SELECT slug FROM shops WHERE id = ?', [id]))[0].slug, `glow-serum-${stamp}`, 'renaming keeps it');
        assert.equal((await edit({ slug: `Serum ${stamp}` })).body.data.slug, `serum-${stamp}`);
        const taken = await edit({ slug: `twin-balm-${stamp}` });
        assert.deepEqual([taken.status, taken.body.code, taken.body.details?.field], [400, 'INVALID_PRODUCT', 'slug']);
    });

    test('are found by slug, drafts only by admins; lists carry the slug; the call by id still answers', async () => {
        const product = (await newProduct({ title: `Lip Tint ${stamp}` })).body.data;
        const res = await app.request('GET', `/api/v1/discover/shop/slug/lip-tint-${stamp}`);
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual([res.body.data.id, res.body.data.owner, res.body.data.brand_profile], [product.id, null, null]);
        assert.equal((await app.request('GET', `/api/v1/discover/shop/findById/${product.id}`)).body.data.slug, `lip-tint-${stamp}`);
        const listed = await app.request('GET', `/api/v1/discover/shop?search=${encodeURIComponent(`Lip Tint ${stamp}`)}`);
        assert.equal(listed.body.data.rows[0].slug, `lip-tint-${stamp}`);

        const draft = (await newProduct({ title: `Draft Tint ${stamp}`, status: 'draft' })).body.data;
        assert.equal((await app.request('GET', `/api/v1/discover/shop/slug/${draft.slug}`)).status, 404);
        assert.equal((await app.request('GET', `/api/v1/discover/shop/slug/${draft.slug}`, { headers: auth })).status, 200);
        assert.equal((await app.request('GET', `/api/v1/discover/shop/slug/no-such-${stamp}`)).body.code, 'NOT_FOUND');
    });
});

test('a topic is found by its slug as by its id', async () => {
    const topic = await insert('INSERT INTO journal_topics (name, slug) VALUES (?, ?)', [`Skin Health ${stamp}`, `skin-health-${stamp}`]);
    const bySlug = await app.request('GET', `/api/v1/journal/topic/skin-health-${stamp}`);
    assert.equal(bySlug.status, 200, bySlug.body.message);
    assert.equal(bySlug.body.data.id, topic);
    assert.equal((await app.request('GET', `/api/v1/journal/topic/${topic}`)).body.data.slug, `skin-health-${stamp}`);
    assert.equal((await app.request('GET', `/api/v1/journal/topic/no-such-topic-${stamp}`)).status, 404);
});

test('the migration gives the live data its slugs: admins\' kept as slugs, the rest from titles, each its own', async () => {
    await migration.down({ sequelize: app.sequelize });
    const article = (title, slug) => insert(
        "INSERT INTO journals (title, author_id, content, status, slug, updated_at) VALUES (?, ?, '<p>x</p>', 'published', ?, '2026-01-02 03:04:05')",
        [title, authorId, slug],
    );
    const typed = await article(`Typed ${stamp}`, `My Post ${stamp}`);
    const twin = await article(`Twin ${stamp}`, `my-post-${stamp}`);
    const none = await article(`Old News ${stamp}`, null);
    const balm = await insert('INSERT INTO shops (title) VALUES (?)', [`Old Balm ${stamp}`]);
    const balm2 = await insert('INSERT INTO shops (title) VALUES (?)', [`Old Balm ${stamp}`]);
    await migration.up({ sequelize: app.sequelize });

    const slugOf = async (table, id) => (await q(`SELECT slug, DATE_FORMAT(updated_at, '%Y-%m-%d %H:%i:%s') AS changed FROM ${table} WHERE id = ?`, [id]))[0];
    assert.deepEqual(await slugOf('journals', typed), { slug: `my-post-${stamp}`, changed: '2026-01-02 03:04:05' });
    assert.equal((await slugOf('journals', twin)).slug, `my-post-${stamp}-2`);
    assert.equal((await slugOf('journals', none)).slug, `old-news-${stamp}`);
    assert.deepEqual([(await slugOf('shops', balm)).slug, (await slugOf('shops', balm2)).slug], [`old-balm-${stamp}`, `old-balm-${stamp}-2`]);
    const [{ nulls }] = await q('SELECT (SELECT COUNT(*) FROM journals WHERE slug IS NULL) + (SELECT COUNT(*) FROM shops WHERE slug IS NULL) AS nulls');
    assert.equal(Number(nulls), 0);
});
