// Page analytics (Phase 6, the website's requests): the website reports views of a professional's or brand's page and
// clicks on its links (POST /profiles/:slug/events); the owner reads the numbers in the dashboard
// (GET /my/profile/analytics) as card analytics gives a card's, and admins any page's (pageAnalytics.service.js).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');

let app, q, insert, auth, owner, slug, today;
const stamp = `${Date.now()}`.slice(-8);
const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0';

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (8, 'Brand', 'BRND')");
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Numbers Admin', ?, 1, 1)", [`numbers-${stamp}@admin.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
    const page = await app.request('POST', '/api/v1/profiles/admin/brands', { body: { name: `Counted Brand ${stamp}`, email: `counted-${stamp}@brand.example` }, headers: auth });
    assert.equal(page.status, 201, page.body.message);
    ({ user_id: owner, slug } = page.body.data);
    [{ today }] = await q("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS today");
});
after(() => app.close());

const send = (body, userAgent = DESKTOP, to = slug) =>
    app.request('POST', `/api/v1/profiles/${to}/events`, { body, headers: { 'User-Agent': userAgent } });
const ownerToken = async () => {
    const { createSession } = require('../src/shared/identity');
    return (await createSession({ id: owner }, { client: 'test' })).tokens.access_token;
};

describe('the website reports', () => {
    test('views and clicks on a visible page; robots are answered but not counted', async () => {
        for (const [body, ua] of [
            [{ event_type: 'PAGE_VIEW', visitor_id: 'v1', session_id: 's1' }, PHONE],
            [{ event_type: 'PAGE_VIEW', visitor_id: 'v1', session_id: 's2' }, PHONE],
            [{ event_type: 'PAGE_VIEW', visitor_id: 'v2' }, DESKTOP],
            [{ event_type: 'WEBSITE_CLICK', event_target: 'https://counted.example', visitor_id: 'v1' }, PHONE],
            [{ event_type: 'PRODUCT_CLICK', event_target: 31, visitor_id: 'v1' }, PHONE],
            [{ event_type: 'PRODUCT_CLICK', event_target: '31', visitor_id: 'v2' }, DESKTOP],
            [{ event_type: 'SOCIAL_CLICK', event_target: 'instagram' }, DESKTOP],
        ]) {
            const res = await send(body, ua);
            assert.equal(res.status, 200, res.body.message);
            assert.deepEqual(res.body.data, { counted: true });
        }
        assert.deepEqual((await send({ event_type: 'PAGE_VIEW' }, 'Mozilla/5.0 (compatible; Googlebot/2.1)')).body.data, { counted: false });
        const [{ n }] = await q('SELECT COUNT(*) AS n FROM profile_page_events WHERE user_id = ?', [owner]);
        assert.equal(Number(n), 7);
    });

    test('refusals: an unknown event, a page that is not shown', async () => {
        const wrong = await send({ event_type: 'LIKE' });
        assert.deepEqual([wrong.status, wrong.body.code, wrong.body.details?.field], [400, 'INVALID_PAGE_EVENT', 'event_type']);
        assert.equal((await send({ event_type: 'PAGE_VIEW' }, DESKTOP, `no-such-page-${stamp}`)).status, 404);
        await q('UPDATE profile_pages SET is_listed = 0 WHERE user_id = ?', [owner]);
        assert.equal((await send({ event_type: 'PAGE_VIEW' })).status, 404);
        await q('UPDATE profile_pages SET is_listed = 1 WHERE user_id = ?', [owner]);
    });
});

describe('the numbers', () => {
    test('the owner sees views, unique visitors, clicks by kind and day, devices and the most clicked', async () => {
        const res = await app.request('GET', '/api/v1/my/profile/analytics', { token: await ownerToken() });
        assert.equal(res.status, 200, res.body.message);
        const n = res.body.data;
        assert.deepEqual(n.page, { id: owner, slug, name: `Counted Brand ${stamp}`, visible: true });
        assert.deepEqual(n.date_range, { from: today, to: today });
        assert.deepEqual(n.summary, { total_views: 3, unique_visitors: 2, total_clicks: 4 });
        assert.deepEqual(n.events, {
            PAGE_VIEW: 3, WEBSITE_CLICK: 1, ACCESS_CARD_CLICK: 0, PRODUCT_CLICK: 2, BOOKING_CLICK: 0, SOCIAL_CLICK: 1, EMAIL_CLICK: 0, PHONE_CLICK: 0,
        });
        assert.deepEqual(n.daily_views, [{ date: today, count: 3 }]);
        assert.deepEqual(n.daily_clicks, [{ date: today, count: 4 }]);
        assert.deepEqual(n.device_breakdown, [{ device_type: 'mobile', count: 2 }, { device_type: 'desktop', count: 1 }]);
        assert.deepEqual(n.top_targets[0], { event_type: 'PRODUCT_CLICK', event_target: '31', count: 2 });
        assert.equal(n.top_targets.length, 3);
    });

    test('between two dates; refused when the dates are wrong', async () => {
        await q("INSERT INTO profile_page_events (user_id, event_type, visitor_id, device_type, created_at) VALUES (?, 'PAGE_VIEW', 'old', 'tablet', '2026-01-15 10:00:00')", [owner]);
        const token = await ownerToken();
        const range = (query) => app.request('GET', `/api/v1/my/profile/analytics?${query}`, { token });
        const january = (await range('from=2026-01-01&to=2026-01-31')).body.data;
        assert.deepEqual([january.summary.total_views, january.daily_views], [1, [{ date: '2026-01-15', count: 1 }]]);
        assert.equal((await range(`from=2026-01-01&to=${today}`)).body.data.summary.total_views, 4);
        for (const [query, field] of [['from=2026-02-30', 'from'], ['from=2099-01-01&to=2099-01-02', 'from'], ['from=2026-03-01&to=2026-02-01', 'from'], ['to=soon', 'to']]) {
            const res = await range(query);
            assert.deepEqual([res.status, res.body.details?.field], [400, field], query);
        }
    });

    test('admins see any page\'s; nobody else', async () => {
        const res = await app.request('GET', `/api/v1/profiles/admin/${owner}/analytics`, { headers: auth });
        assert.equal(res.status, 200, res.body.message);
        assert.equal(res.body.data.summary.total_views, 3);
        assert.equal((await app.request('GET', `/api/v1/profiles/admin/${owner}/analytics`)).status, 401);
        assert.equal((await app.request('GET', '/api/v1/my/profile/analytics')).status, 401);
    });
});
