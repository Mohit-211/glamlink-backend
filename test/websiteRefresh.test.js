// The website's cache-refresh hook (Phase 6, the website's requests): after a change made through the API (a write by
// a signed-in admin or account that succeeded), the website is told which of its data changed, by tag, with the
// shared secret; changes close together go in one call; visitors' writes and refused ones send nothing
// (integrations/websiteRefresh.js, core/http/afterChanges.js, `refresh` in the modules' routes).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { once } = require('events');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');

let app, q, insert, auth, website, brand, authorId;
const calls = [];
let answer = 200;
const stamp = `${Date.now()}`.slice(-8);

before(async () => {
    // The website's receiving route, as the website adds it.
    website = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            calls.push({ method: req.method, path: req.url, authorization: req.headers.authorization, body: JSON.parse(body) });
            res.writeHead(answer).end();
        });
    });
    website.listen(0, '127.0.0.1');
    await once(website, 'listening');
    process.env.WEBSITE_REFRESH_URL = `http://127.0.0.1:${website.address().port}/api/revalidate`;
    process.env.WEBSITE_REFRESH_SECRET = 'refresh-secret-for-tests';

    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (8, 'Brand', 'BRND')");
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Refresh Admin', ?, 1, 1)", [`refresh-${stamp}@admin.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
    authorId = await insert("INSERT INTO authors (name) VALUES ('Refresh Writer')");
});
after(async () => {
    await app.close();
    website.close();
});

// The call the website gets after the first `seen` ones, waiting up to 3 seconds (null without one).
const callAfter = async (seen) => {
    for (let waited = 0; waited < 3000 && calls.length <= seen; waited += 50) await new Promise((resolve) => setTimeout(resolve, 50));
    return calls[seen] ?? null;
};
const newArticle = (title) => app.request('POST', '/api/v1/journal', { body: { title, author_id: authorId, content: '<p>x</p>', status: 'published' }, headers: auth });

test('an admin\'s change tells the website which data changed, with the shared secret', async () => {
    const seen = calls.length;
    const res = await app.request('POST', '/api/v1/profiles/admin/brands', { body: { name: `Refreshed Brand ${stamp}`, email: `refreshed-${stamp}@brand.example` }, headers: auth });
    assert.equal(res.status, 201, res.body.message);
    brand = res.body.data;
    assert.deepEqual(await callAfter(seen), {
        method: 'POST', path: '/api/revalidate', authorization: 'Bearer refresh-secret-for-tests', body: { tags: ['profiles'] },
    });
});

test('changes close together go in one call', async () => {
    const seen = calls.length;
    assert.equal((await newArticle(`Refresh one ${stamp}`)).status, 201);
    assert.equal((await app.request('POST', '/api/v1/discover/shop', { body: { title: `Refresh balm ${stamp}`, status: 'published' }, headers: auth })).status, 201);
    assert.deepEqual((await callAfter(seen)).body, { tags: ['discover', 'journal', 'shop', 'topics'] });
    assert.equal(await callAfter(seen + 1), null, 'one call');
});

test('an owner\'s change too; a visitor\'s write or a refused change sends nothing', async () => {
    const { createSession } = require('../src/shared/identity');
    const token = (await createSession({ id: brand.user_id }, { client: 'test' })).tokens.access_token;
    let seen = calls.length;
    assert.equal((await app.request('PUT', '/api/v1/my/profile', { body: { tagline: 'Refreshed' }, token })).status, 200);
    assert.deepEqual((await callAfter(seen)).body, { tags: ['profiles'] });

    seen = calls.length;
    assert.equal((await app.request('POST', `/api/v1/profiles/${brand.slug}/events`, { body: { event_type: 'PAGE_VIEW' } })).status, 200);
    assert.equal((await app.request('POST', '/api/v1/discover/shop', { body: { title: 'x', owner_id: 999999999 }, headers: auth })).status, 400);
    assert.equal(await callAfter(seen), null);
});

test('the website not answering changes nothing for the API', async () => {
    answer = 500;
    const seen = calls.length;
    assert.equal((await newArticle(`Refresh two ${stamp}`)).status, 201);
    assert.ok(await callAfter(seen), 'the website was called');
    answer = 200;
});
