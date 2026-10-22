// The magazine (Phase 6): the website's 14 issues loaded by migration 20261023-1100, who appears in each, the issues
// on profile pages, admin editing, and the covers script (website/magazine, scripts/magazine-covers.js).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const { photo } = require('./cardFixtures');
const config = require('../src/core/config/config');
const { UPLOADS_DIR } = require('../src/core/config/paths');
const { copyCovers } = require('../scripts/magazine-covers');

let app, q, insert, auth;
const ids = {};
const stamp = `${Date.now()}`.slice(-8);

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (7, 'Professional', 'PRO'), (8, 'Brand', 'BRND')");
    const account = async (name, type, handle) => {
        const id = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active) VALUES (?, ?, 'professional', ?, 'ACCEPTED', 1)",
            [`${handle}@magazine.example`, type === 'brand' ? 8 : 7, type]);
        await insert('INSERT INTO profiles (user_id, email, name) VALUES (?, ?, ?)', [id, `${handle}@magazine.example`, name]);
        await insert("INSERT INTO business_cards (user_id, name, business_name, status, slug, business_card_link) VALUES (?, ?, ?, 'accepted', ?, ?)", [id, name, name, handle, `https://glamlink.net/access/${handle}`]);
        return id;
    };
    ids.star = await account('Cover Star', 'individual', `coverstar${stamp}`);
    ids.brand = await account('Mentioned Brand', 'brand', `mentionedbrand${stamp}`);
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Magazine Admin', ?, 1, 1)", [`magazine-admin-${stamp}@test.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
});
after(() => app.close());

const admin = (method, url, body) => app.request(method, `/api/v1${url}`, { body, headers: auth });
const issueId = async (slug) => (await q('SELECT id FROM magazine_issues WHERE slug = ?', [slug]))[0].id;

describe('the issues', () => {
    test('the website\'s 14 issues are loaded, newest first, with their Publuu flipbooks', async () => {
        const res = await app.request('GET', '/api/v1/magazine?limit=50');
        assert.equal(res.status, 200);
        const slugs = res.body.data.rows.map((r) => r.slug);
        assert.equal(res.body.data.count, 14);
        assert.deepEqual([slugs[0], slugs.at(-1)], ['issue-117', 'issue-104']);
        const first = res.body.data.rows[0];
        assert.equal(first.cover_image, 'https://glamlink.net/magazine/issue117.png');
        assert.deepEqual(first.flipbook, { publuu_account_id: 992531, publuu_flipbook_id: 2578509, url: 'https://publuu.com/flip-book/992531/2578509/page/1?embed' });
    });

    test('an issue names who appears in it, cover first; their pages list the issue', async () => {
        const res = await admin('PUT', `/magazine/admin/${await issueId('issue-110')}/features`, {
            features: [{ user_id: ids.brand, role: 'mentioned' }, { user_id: ids.star, role: 'cover', page_number: 1 }],
        });
        assert.equal(res.status, 200, res.body.message);
        const issue = (await app.request('GET', '/api/v1/magazine/issue-110')).body.data;
        assert.deepEqual(issue.features.map((f) => [f.name, f.role, f.page_number]), [['Cover Star', 'cover', 1], ['Mentioned Brand', 'mentioned', null]]);
        assert.equal(issue.features[0].slug, `coverstar${stamp}`);

        const page = (await app.request('GET', `/api/v1/profiles/coverstar${stamp}`)).body.data;
        assert.deepEqual(page.magazine.rows.map((r) => [r.slug, r.role]), [['issue-110', 'cover']]);
        assert.equal((await app.request('GET', `/api/v1/profiles/mentionedbrand${stamp}/magazine`)).body.data.count, 1);
        assert.equal((await admin('PUT', `/magazine/admin/${await issueId('issue-110')}/features`, { features: [{ user_id: ids.star, role: 'star' }] })).status, 400);
    });
});

describe('admins', () => {
    test('add an issue with its cover, publish it, and delete it', async () => {
        const created = await app.form('POST', '/api/v1/magazine/admin', {
            fields: { title: `Issue 9${stamp.slice(-2)}`, issue_number: '200', status: 'draft', publish_date: '2026-11-01', flipbook_url: 'https://publuu.com/flip-book/1/2' },
            files: { images: [photo('cover.png')] },
            headers: auth,
        });
        assert.equal(created.status, 201, created.body.message);
        const issue = created.body.data;
        assert.match(issue.cover_image, /\/images\/images-/);
        assert.deepEqual(issue.flipbook, { url: 'https://publuu.com/flip-book/1/2' });
        assert.equal((await app.request('GET', `/api/v1/magazine/${issue.slug}`)).status, 404, 'a draft');

        await admin('PUT', `/magazine/admin/${issue.id}`, { status: 'published' });
        const list = (await app.request('GET', '/api/v1/magazine?limit=1')).body.data;
        assert.equal(list.rows[0].slug, issue.slug, 'issue 200 comes first');
        assert.deepEqual((await admin('PUT', `/magazine/admin/${issue.id}`, { publish_date: 'November' })).body.details, { field: 'publish_date' });

        assert.equal((await admin('DELETE', `/magazine/admin/${issue.id}`)).status, 200);
        assert.equal((await app.request('GET', `/api/v1/magazine/${issue.slug}`)).status, 404);
        assert.equal((await app.request('GET', '/api/v1/magazine/admin/list')).status, 401);
    });
});

describe('the covers script', () => {
    test('copies a cover from another host into the uploads and points the issue at it', async () => {
        const base = config.API_BASE_URL.replace(/\/+$/, '');
        const file = `cover-source-${stamp}.png`;
        await sharp({ create: { width: 40, height: 60, channels: 3, background: '#cc6699' } }).png().toFile(path.join(UPLOADS_DIR, 'images', file));
        // Every other cover counts as copied already, so nothing leaves the test machine.
        await q('UPDATE magazine_issues SET cover_image = ? WHERE slug <> ?', [`${base}/images/already.png`, 'issue-111']);
        await q('UPDATE magazine_issues SET cover_image = ? WHERE slug = ?', [`${app.base}/images/${file}`, 'issue-111']);

        const dry = await copyCovers({ sequelize: app.sequelize, dryRun: true, log: () => {} });
        assert.deepEqual(dry.map((r) => r.slug), ['issue-111']);
        const [copied] = await copyCovers({ sequelize: app.sequelize, log: () => {} });
        assert.match(copied.to, new RegExp(`^${base}/images/magazine-issue-111-[0-9a-f]{8}\\.png$`));
        assert.ok(fs.existsSync(path.join(UPLOADS_DIR, 'images', copied.to.split('/images/')[1])));
        const [{ cover_image: cover }] = await q("SELECT cover_image FROM magazine_issues WHERE slug = 'issue-111'");
        assert.equal(cover, copied.to);
        assert.deepEqual(await copyCovers({ sequelize: app.sequelize, log: () => {} }), [], 'nothing left to copy');
    });
});
