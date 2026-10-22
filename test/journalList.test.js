// The journal list for the website (Phase 6): GET /journal pages light article cards with category, search,
// exclude and featured filters; categories are clean and counted; drafts stay with admins
// (journal.service.js listJournals, migration 20261023-0100).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const { paging, idList } = require('../src/core/http/paging');
const migration = require('../src/core/db/migrations/20261023-0100-journal-featured-and-categories');

let app, q, insert, adminToken;
const ids = {};
const logs = [];

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };

    // The data as the live copy has it, from before the migration: titles with trailing spaces, loose slugs.
    await migration.down({ sequelize: app.sequelize });
    ids.cover = await insert("INSERT INTO journal_categories (title, slug) VALUES ('Cover Feature ', 'cover-feature')");
    ids.spotlight = await insert("INSERT INTO journal_categories (title, slug) VALUES ('Pro Spotlight ', 'pro-spotlight')");
    ids.news = await insert("INSERT INTO journal_categories (title, slug) VALUES ('What''s New', 'what''s-new')");
    ids.empty = await insert("INSERT INTO journal_categories (title, slug) VALUES ('Glam Drop', 'glam-drop')");
    ids.ana = await insert("INSERT INTO authors (name, profile_image) VALUES ('Ana Writer', 'https://api.example/ana.png')");
    ids.ben = await insert("INSERT INTO authors (name) VALUES ('Ben Quill')");

    const article = (title, category, date, { author = ids.ana, status = 'published', created = '2026-01-01 00:00:00' } = {}) =>
        insert(
            `INSERT INTO journals (title, author_id, category_id, short_description, content, publish_date, status, created_at, slug)
             VALUES (?, ?, ?, ?, '<p>The whole article</p>', ?, ?, ?, ?)`,
            [title, author, category, `About ${title}`, date, status, created, title.toLowerCase().replace(/\W+/g, '-')],
        );
    ids.oldCover = await article('Old cover story', ids.cover, '2026-03-01 10:00:00');
    ids.newCover = await article('New cover story', ids.cover, '2026-09-01 10:00:00');
    ids.draftCover = await article('Draft cover story', ids.cover, '2026-10-01 10:00:00', { status: 'draft' });
    ids.spot1 = await article('Spotlight on lashes', ids.spotlight, '2026-08-01 10:00:00', { author: ids.ben });
    ids.spot2 = await article('Spotlight on brows', ids.spotlight, '2026-07-01 10:00:00');
    ids.news1 = await article('Glow 100% guaranteed?', ids.news, '2026-06-01 10:00:00');
    ids.undated = await article('Undated note', ids.news, null, { created: '2026-08-15 10:00:00' });

    // Products and downloads multiply an article's rows in the full list: its count must not grow with them.
    const shop = await insert("INSERT INTO shops (title) VALUES ('Serum')");
    const shop2 = await insert("INSERT INTO shops (title) VALUES ('Balm')");
    await q('INSERT INTO journal_shops (journal_id, shop_id) VALUES (?, ?), (?, ?)', [ids.newCover, shop, ids.newCover, shop2]);
    await q("INSERT INTO journal_downloads (journal_id, title, file_name) VALUES (?, 'Guide', 'https://api.example/guide.pdf'), (?, 'Sheet', 'https://api.example/sheet.pdf')", [ids.newCover, ids.newCover]);

    await migration.up({ sequelize: app.sequelize, log: (line) => logs.push(line) });

    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM')");
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Journal Admin', ?, 1, 1)", [`journal-admin-${Date.now()}@test.example`]);
    adminToken = jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' });
});
after(() => app.close());

const list = async (query) => {
    const res = await app.request('GET', `/api/v1/journal?${query}`);
    assert.equal(res.status, 200, res.body.message);
    return res.body.data;
};
const titles = (data) => data.rows.map((row) => row.title);
const PUBLISHED = 6;

describe('the migration', () => {
    test('trims category titles and makes URL slugs, keeping the originals', async () => {
        const rows = await q('SELECT id, title, slug FROM journal_categories WHERE id IN (?) ORDER BY id', [[ids.cover, ids.spotlight, ids.news, ids.empty]]);
        assert.deepEqual(rows.map((r) => [r.title, r.slug]), [
            ['Cover Feature', 'cover-feature'], ['Pro Spotlight', 'pro-spotlight'], ["What's New", 'whats-new'], ['Glam Drop', 'glam-drop'],
        ]);
        const [backup] = await q('SELECT title_before, slug_before FROM journal_category_backup WHERE journal_category_id = ?', [ids.news]);
        assert.equal(backup.slug_before, "what's-new");
        assert.ok(logs.some((line) => line.includes('journal categories cleaned: 3 of')));
    });

    test('features the newest published Cover Feature article', async () => {
        const featured = await q('SELECT id FROM journals WHERE is_featured = 1');
        assert.deepEqual(featured.map((r) => r.id), [ids.newCover]);
    });
});

describe('GET /journal without list parameters', () => {
    test('answers every published article in full, as before, with a true count', async () => {
        const data = await list('');
        assert.equal(data.rows.length, PUBLISHED);
        assert.equal(data.count, PUBLISHED, 'products and downloads do not inflate the count');
        const cover = data.rows.find((row) => row.id === ids.newCover);
        assert.equal(cover.content, '<p>The whole article</p>');
        assert.equal(cover.shops.length, 2);
        assert.ok(!titles(data).includes('Draft cover story'));
    });
});

describe('GET /journal with list parameters', () => {
    test('pages light cards, newest first (an undated article by the date it was written)', async () => {
        const first = await list('page=1&limit=3');
        assert.equal(first.count, PUBLISHED);
        assert.deepEqual(titles(first), ['New cover story', 'Undated note', 'Spotlight on lashes']);
        const second = await list('page=2&limit=3');
        assert.deepEqual(titles(second), ['Spotlight on brows', 'Glow 100% guaranteed?', 'Old cover story']);
        assert.deepEqual((await list('page=3&limit=3')).rows, []);

        const card = first.rows[0];
        assert.deepEqual(Object.keys(card).toSorted(), [
            'cover_image', 'created_at', 'id', 'is_featured', 'journal_author', 'journal_category', 'publish_date', 'short_description', 'slug', 'title', 'updated_at',
        ]);
        assert.deepEqual(card.journal_category, { id: ids.cover, title: 'Cover Feature', slug: 'cover-feature' });
        assert.deepEqual(card.journal_author, { id: ids.ana, name: 'Ana Writer', profile_image: 'https://api.example/ana.png' });
    });

    test('filters by category slug or id; an unknown category is empty', async () => {
        const bySlug = await list('category=pro-spotlight');
        assert.deepEqual(titles(bySlug), ['Spotlight on lashes', 'Spotlight on brows']);
        assert.equal(bySlug.count, 2);
        assert.deepEqual(titles(await list(`category=${ids.spotlight}`)), titles(bySlug));
        assert.deepEqual(titles(await list('category=whats-new')), ['Undated note', 'Glow 100% guaranteed?']);
        assert.deepEqual(await list('category=no-such-category'), { count: 0, rows: [] });
    });

    test('searches titles, descriptions, category titles and author names', async () => {
        assert.deepEqual(titles(await list('search=brows')), ['Spotlight on brows']);
        assert.deepEqual(titles(await list('search=About%20Old')), ['Old cover story']);
        assert.deepEqual(titles(await list('search=cover%20feature')), ['New cover story', 'Old cover story']);
        assert.deepEqual(titles(await list('search=QUILL')), ['Spotlight on lashes']);
        assert.deepEqual(titles(await list('search=100%25')), ['Glow 100% guaranteed?'], '% is a character, not a wildcard');
        assert.equal((await list('search=_')).count, 0, '_ is a character, not a wildcard');
    });

    test('leaves out excluded ids, and finds the featured article', async () => {
        const featured = await list('featured=true&limit=1');
        assert.deepEqual(titles(featured), ['New cover story']);
        assert.equal(featured.rows[0].is_featured, true);
        const rest = await list(`limit=12&exclude=${ids.newCover},${ids.undated}`);
        assert.equal(rest.count, PUBLISHED - 2);
        assert.ok(!titles(rest).includes('New cover story'));
        // Related articles: the same category, without the article being read.
        assert.deepEqual(titles(await list(`category=cover-feature&limit=3&exclude=${ids.newCover}`)), ['Old cover story']);
    });

    test('page and limit fall back to their defaults and the limit is capped', () => {
        assert.deepEqual(paging({}), { page: 1, limit: 12, offset: 0 });
        assert.deepEqual(paging({ page: '3', limit: '5' }), { page: 3, limit: 5, offset: 10 });
        assert.deepEqual(paging({ page: '-1', limit: '1000' }), { page: 1, limit: 50, offset: 0 });
        assert.deepEqual(paging({ page: 'x', limit: '0' }), { page: 1, limit: 12, offset: 0 });
        assert.deepEqual(idList('12, 15,x,-3'), [12, 15]);
        assert.deepEqual(idList(['4', '5,6']), [4, 5, 6]);
    });
});

describe('drafts', () => {
    test('are not served to the public, by id or by category', async () => {
        const byId = await app.request('GET', `/api/v1/journal/findJournalById/${ids.draftCover}`);
        assert.equal(byId.body.data, 'No Journal Found');
        const byCategory = await app.request('GET', `/api/v1/journal/${ids.cover}`);
        assert.deepEqual(byCategory.body.data.rows.map((r) => r.title).toSorted(), ['New cover story', 'Old cover story']);
        assert.equal(byCategory.body.data.count, 2);
    });

    test('are served to an admin, who edits them', async () => {
        const res = await app.request('GET', `/api/v1/journal/findJournalById/${ids.draftCover}`, { headers: { Authorization: `Bearer ${adminToken}` } });
        assert.equal(res.body.data.title, 'Draft cover story');
    });
});

const featureSpotlight = (value) =>
    app.request('PUT', `/api/v1/journal/${ids.spot2}`, { body: { is_featured: value }, headers: { Authorization: `Bearer ${adminToken}` } });

describe('featuring an article in admin', () => {
    test('is_featured is set and cleared through the article edit', async () => {
        const edit = featureSpotlight;
        assert.equal((await edit('true')).status, 200);
        assert.deepEqual(titles(await list('featured=true')), ['New cover story', 'Spotlight on brows']);
        assert.equal((await edit('false')).status, 200);
        assert.deepEqual(titles(await list('featured=true')), ['New cover story']);
    });
});

describe('GET /journalCategory', () => {
    test('counts each category\'s published articles, in the sidebar\'s order', async () => {
        const res = await app.request('GET', '/api/v1/journalCategory');
        const ours = res.body.data.rows.filter((c) => [ids.cover, ids.spotlight, ids.news, ids.empty].includes(c.id));
        assert.deepEqual(ours.map((c) => [c.title, c.article_count]), [
            ['Cover Feature', 2], ['Glam Drop', 0], ['Pro Spotlight', 2], ["What's New", 2],
        ]);
    });

    test('an admin sets the order; titles are trimmed and slugged on save', async () => {
        const auth = { Authorization: `Bearer ${adminToken}` };
        assert.equal((await app.request('PUT', `/api/v1/journalCategory/${ids.news}`, { body: { sort_order: '-1' }, headers: auth })).status, 200);
        const res = await app.request('GET', '/api/v1/journalCategory');
        const ours = res.body.data.rows.filter((c) => [ids.cover, ids.spotlight, ids.news, ids.empty].includes(c.id));
        assert.equal(ours[0].title, "What's New");
        assert.equal((await app.request('PUT', `/api/v1/journalCategory/${ids.news}`, { body: { sort_order: 'soon' }, headers: auth })).status, 400);

        const created = await app.request('POST', '/api/v1/journalCategory', { body: { title: '  Nails + Makeup  ' }, headers: auth });
        assert.equal(created.status, 201, created.body.message);
        assert.equal(created.body.data.title, 'Nails + Makeup');
        assert.equal(created.body.data.slug, 'nails-makeup');
    });
});
