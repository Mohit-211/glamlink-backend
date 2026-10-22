// The home page's tiles and hand-set parts (Phase 6): topics marked for the home page, in order
// (GET /journal/topic?featured=true), and the home settings (GET and PUT /settings/home), migration 20261023-0200.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const { photo } = require('./cardFixtures');
const config = require('../src/core/config/config');
const migration = require('../src/core/db/migrations/20261023-0200-home-tiles-and-settings');

let app, q, insert, auth;
const ids = {};
const logs = [];
const stamp = Date.now();
const image = (name) => `${config.API_BASE_URL.replace(/\/+$/, '')}/images/${name}`;

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };

    // Topics as the live copy has them, before the migration: three of the mockup's six exist.
    await migration.down({ sequelize: app.sequelize });
    ids.skin = await insert("INSERT INTO journal_topics (name, slug) VALUES ('Skin', ?)", [`skin-${stamp}`]);
    ids.hair = await insert("INSERT INTO journal_topics (name, slug) VALUES ('hair', ?)", [`hair-${stamp}`]);
    ids.nails = await insert("INSERT INTO journal_topics (name, slug) VALUES ('Nails + Makeup ', ?)", [`nails-${stamp}`]);
    ids.botox = await insert("INSERT INTO journal_topics (name, slug) VALUES ('Botox', ?)", [`botox-${stamp}`]);
    await migration.up({ sequelize: app.sequelize, log: (line) => logs.push(line) });

    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM')");
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Home Admin', ?, 1, 1)", [`home-admin-${stamp}@test.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
});
after(() => app.close());

const tiles = async () => {
    const res = await app.request('GET', '/api/v1/journal/topic?featured=true');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data), 'a plain list, like the full topic list');
    return res.body.data;
};

describe('home tiles', () => {
    test('the migration makes the mockup\'s topics the tiles, in its order, and lists the missing ones', async () => {
        assert.deepEqual((await tiles()).map((t) => [t.id, t.featured_order]), [[ids.skin, 1], [ids.hair, 4], [ids.nails, 6]]);
        const line = logs.find((l) => l.includes('home tiles'));
        assert.match(line, /no topic named Aesthetic Treatments, Plastic Surgery, Wellness/);
    });

    test('the full topic list is unchanged: every topic by name', async () => {
        const res = await app.request('GET', '/api/v1/journal/topic');
        const ours = res.body.data.filter((t) => Object.values(ids).includes(t.id));
        assert.deepEqual(ours.map((t) => t.name), ['Botox', 'hair', 'Nails + Makeup ', 'Skin']);
    });

    test('an admin adds a tile, orders it and gives it a square image', async () => {
        const res = await app.request('PUT', `/api/v1/journal/topic/${ids.botox}`, {
            body: { is_featured: 'true', featured_order: '2', tile_image: image('botox-tile.png') },
            headers: auth,
        });
        assert.equal(res.status, 200, res.body.message);
        const list = await tiles();
        assert.deepEqual(list.map((t) => t.id), [ids.skin, ids.botox, ids.hair, ids.nails]);
        assert.equal(list[1].tile_image, image('botox-tile.png'));

        const bad = (body) => app.request('PUT', `/api/v1/journal/topic/${ids.botox}`, { body, headers: auth });
        assert.equal((await bad({ tile_image: 'https://elsewhere.example/tile.png' })).status, 400);
        assert.equal((await bad({ featured_order: 'first' })).status, 400);
        assert.equal((await bad({ is_featured: 'false', tile_image: '' })).status, 200);
        assert.deepEqual((await tiles()).map((t) => t.id), [ids.skin, ids.hair, ids.nails]);
    });
});

const putHome = (body) => app.request('PUT', '/api/v1/settings/home', { body, headers: auth });

describe('home settings', () => {
    test('start with the mockup\'s popular searches and no images', async () => {
        const res = await app.request('GET', '/api/v1/settings/home');
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.data.popular_searches, ['Botox', 'Skin Rejuvenation', 'Weight Loss', 'Facials', 'Plastic Surgery']);
        assert.equal(res.body.data.hero_image, null);
        assert.equal(res.body.data.find_professional_image, null);
    });

    test('only an admin changes them', async () => {
        const res = await app.request('PUT', '/api/v1/settings/home', { body: { popular_searches: ['Lashes'] } });
        assert.equal(res.status, 401);
    });

    test('an admin uploads the hero image and sets it with the searches; the rest stays', async () => {
        const upload = await app.form('POST', '/api/v1/journal/upload', { files: { images: [photo('hero.png')] }, headers: auth });
        assert.equal(upload.status, 201, upload.body.message);
        const hero = upload.body.data.location;

        const res = await app.request('PUT', '/api/v1/settings/home', {
            body: { hero_image: hero, popular_searches: JSON.stringify([' Lashes ', 'Botox', 'Lashes']) },
            headers: auth,
        });
        assert.equal(res.status, 200, res.body.message);
        assert.equal(res.body.data.hero_image, hero);
        assert.deepEqual(res.body.data.popular_searches, ['Lashes', 'Botox']);
        assert.equal(res.body.data.find_professional_image, null);

        const pro = await app.request('PUT', '/api/v1/settings/home', { body: { find_professional_image: image('pro.png') }, headers: auth });
        assert.equal(pro.body.data.hero_image, hero, 'fields not sent stay');
        const shown = await app.request('GET', '/api/v1/settings/home');
        assert.equal(shown.body.data.find_professional_image, image('pro.png'));

        const cleared = await app.request('PUT', '/api/v1/settings/home', { body: { hero_image: '' }, headers: auth });
        assert.equal(cleared.body.data.hero_image, null);
    });

    test('refuses images from elsewhere and too many searches, naming the field', async () => {
        const put = putHome;
        const elsewhere = await put({ hero_image: 'https://elsewhere.example/hero.png' });
        assert.equal(elsewhere.status, 400);
        assert.equal(elsewhere.body.code, 'INVALID_SETTING');
        assert.deepEqual(elsewhere.body.details, { field: 'hero_image' });
        const many = await put({ popular_searches: Array.from({ length: 11 }, (_, i) => `Term ${i}`) });
        assert.equal(many.status, 400);
        assert.deepEqual(many.body.details, { field: 'popular_searches' });
        assert.equal((await put({ popular_searches: 'Botox' })).status, 400, 'a list, not a word');
    });
});
