// Ads (Phase 6): GET /ads?live=true serves only the ads to show now (by slot and page); POST /ads/track counts the
// website's views and clicks per ad and day; admins read the counts (adStats.service.js, migration 20261023-1300).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');

let app, q, insert, auth;
const ids = {};
const stamp = `${Date.now()}`.slice(-8);
const slot = `slot-${stamp}`;

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    const ad = (name, { start = 'NULL', end = 'NULL', status = 'active', pages = ['journal-listing'], order = 0, adSlot = slot } = {}) =>
        insert(`INSERT INTO ads (slot_id, image_url, link_url, alt_text, width, height, pages, start_date, end_date, status, sort_order)
                VALUES (?, 'https://api.example/ad.png', 'https://brand.example', ?, 300, 250, ?, ${start}, ${end}, ?, ?)`, [adSlot, name, JSON.stringify(pages), status, order]);
    ids.live = await ad('live', { order: 2 });
    ids.endsToday = await ad('ends today', { end: 'CURDATE()', order: 1 });
    ids.article = await ad('article only', { pages: ['journal-article'], order: 3 });
    ids.future = await ad('future', { start: 'DATE_ADD(CURDATE(), INTERVAL 1 DAY)' });
    ids.expired = await ad('expired', { end: 'DATE_SUB(CURDATE(), INTERVAL 1 DAY)' });
    ids.paused = await ad('paused', { status: 'inactive' });
    ids.otherSlot = await ad('other slot', { adSlot: `other-${stamp}` });
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM')");
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Ads Admin', ?, 1, 1)", [`ads-admin-${stamp}@test.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
});
after(() => app.close());

const mine = (rows) => rows.filter((row) => Object.values(ids).includes(row.id)).map((row) => row.alt_text);
const track = (body) => app.request('POST', '/api/v1/ads/track', { body });

describe('GET /ads', () => {
    test('live=true: active ads inside their dates (whole days), in order, by slot and page', async () => {
        assert.deepEqual(mine((await app.request('GET', `/api/v1/ads?live=true&slot=${slot}`)).body.data.rows), ['ends today', 'live', 'article only']);
        assert.deepEqual(mine((await app.request('GET', `/api/v1/ads?live=true&slot=${slot}&page=journal-listing`)).body.data.rows), ['ends today', 'live']);
        assert.deepEqual(mine((await app.request('GET', '/api/v1/ads?live=true&page=journal-article')).body.data.rows), ['article only']);
    });

    test('without live: every ad, as the admin list has it', async () => {
        const all = mine((await app.request('GET', '/api/v1/ads')).body.data.rows);
        for (const name of ['future', 'expired', 'paused', 'other slot']) assert.ok(all.includes(name), name);
    });
});

describe('counting', () => {
    test('views and clicks are counted per ad and day', async () => {
        for (const type of ['impression', 'impression', 'impression', 'click']) assert.equal((await track({ ad_id: ids.live, type })).status, 200);
        const totals = await app.request('GET', '/api/v1/ads/admin/stats', { headers: auth });
        assert.equal(totals.status, 200);
        assert.deepEqual(totals.body.data.find((t) => t.ad_id === ids.live), { ad_id: ids.live, impressions: 3, clicks: 1, click_rate: 33.33 });
        const daily = await app.request('GET', `/api/v1/ads/${ids.live}/stats`, { headers: auth });
        assert.deepEqual([daily.body.data.impressions, daily.body.data.clicks, daily.body.data.days.length], [3, 1, 1]);
        assert.match(daily.body.data.days[0].day, /^\d{4}-\d{2}-\d{2}$/);
        const none = await app.request('GET', `/api/v1/ads/${ids.live}/stats?from=2000-01-01&to=2000-01-02`, { headers: auth });
        assert.deepEqual(none.body.data.days, []);
    });

    test('refuses an unknown ad or event; the counts are for admins', async () => {
        assert.deepEqual((await track({ ad_id: ids.live, type: 'hover' })).body.details, { field: 'type' });
        assert.deepEqual((await track({ ad_id: 99999999, type: 'click' })).body.details, { field: 'ad_id' });
        assert.equal((await app.request('GET', '/api/v1/ads/admin/stats')).status, 401);
        assert.equal((await app.request('GET', `/api/v1/ads/${ids.live}/stats?from=yesterday`, { headers: auth })).status, 400);
    });
});
