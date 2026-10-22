// The website's forms that stored nothing (Phase 6): newsletter sign-ups and "Apply for Feature" requests, with
// their admin lists, CSV export and delete; and the guest application's businessName and instagram fields
// (website/inquiries).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');

let app, q, auth;
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = (name) => `${name}-${stamp}@test.example`;

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM')");
    const res = await q("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Forms Admin', ?, 1, 1)", [email('admin')]);
    const adminId = res.insertId ?? res;
    auth = { Authorization: `Bearer ${jwt.sign({ id: adminId, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
});
after(() => app.close());

const subscribe = (body) => app.request('POST', '/api/v1/newsletter/subscribe', { body });

describe('newsletter', () => {
    test('a sign-up is stored once per email; signing up again answers the same and fills in a missing name', async () => {
        const first = await subscribe({ email: email('Reader').toUpperCase(), first_name: ' Rae ', source: 'popup' });
        assert.equal(first.status, 200, first.body.message);
        assert.deepEqual(first.body.data, { subscribed: true });
        const again = await subscribe({ email: email('reader'), first_name: 'Someone else', last_name: 'Reed', source: 'footer' });
        assert.deepEqual(again.body.data, { subscribed: true });

        const rows = await q('SELECT email, first_name, last_name, source, ip_address FROM newsletter_subscribers WHERE email = ?', [email('reader')]);
        assert.equal(rows.length, 1);
        assert.deepEqual({ ...rows[0], ip_address: Boolean(rows[0].ip_address) }, {
            email: email('reader'), first_name: 'Rae', last_name: 'Reed', source: 'popup', ip_address: true,
        });
    });

    test('refuses a bad email or source, naming the field', async () => {
        const bad = await subscribe({ email: 'not-an-email' });
        assert.equal(bad.status, 400);
        assert.equal(bad.body.code, 'INVALID_INPUT');
        assert.deepEqual(bad.body.details, { field: 'email' });
        const source = await subscribe({ email: email('src'), source: 'The Popup!' });
        assert.deepEqual(source.body.details, { field: 'source' });
        assert.equal((await subscribe({})).body.details.field, 'email');
    });

    test('admins list, search, export and delete subscribers', async () => {
        assert.equal((await app.request('GET', '/api/v1/newsletter/list')).status, 401);
        await subscribe({ email: email('formula'), first_name: '=HYPERLINK("http://evil.example")', source: 'podcast' });

        const list = await app.request('GET', `/api/v1/newsletter/list?search=${encodeURIComponent(stamp)}`, { headers: auth });
        assert.equal(list.status, 200);
        assert.deepEqual(list.body.data.rows.map((r) => r.email), [email('formula'), email('reader')]);
        assert.equal(list.body.data.count, 2);
        const podcast = await app.request('GET', `/api/v1/newsletter/list?source=podcast&search=${encodeURIComponent(stamp)}`, { headers: auth });
        assert.deepEqual(podcast.body.data.rows.map((r) => r.email), [email('formula')]);

        const res = await fetch(`${app.base}/api/v1/newsletter/export?search=${encodeURIComponent(stamp)}`, { headers: auth });
        assert.equal(res.status, 200);
        assert.match(res.headers.get('content-type'), /^text\/csv/);
        assert.match(res.headers.get('content-disposition'), /^attachment; filename="?newsletter-subscribers-\d{4}-\d{2}-\d{2}\.csv"?$/);
        const csv = await res.text();
        const lines = csv.trim().split('\r\n');
        assert.equal(lines[0], '"Email","First name","Last name","Source","Signed up"');
        assert.ok(lines.some((line) => line.startsWith(`"${email('formula')}","'=HYPERLINK(""http://evil.example"")"`)), 'a formula is shown, not run');

        const ids = list.body.data.rows.map((r) => r.id);
        const deleted = await app.request('POST', '/api/v1/newsletter/delete', { body: { ids }, headers: auth });
        assert.deepEqual(deleted.body.data, { deleted: 2 });
        const remaining = await app.request('GET', `/api/v1/newsletter/list?search=${encodeURIComponent(stamp)}`, { headers: auth });
        assert.equal(remaining.body.data.count, 0);
    });
});

describe('feature requests', () => {
    const request = {
        name: 'Niki Capobianco', specialty: 'Injector', email: email('niki'), phone: '(702) 555-0199', city: 'Las Vegas, NV', interest: 'Cover Feature',
    };

    test('every field is required; a refusal names the field', async () => {
        for (const field of Object.keys(request)) {
            const res = await app.request('POST', '/api/v1/feature-request', { body: { ...request, [field]: ' ' } });
            assert.equal(res.status, 400, field);
            assert.deepEqual(res.body.details, { field });
        }
        const phone = await app.request('POST', '/api/v1/feature-request', { body: { ...request, phone: '555' } });
        assert.deepEqual(phone.body.details, { field: 'phone' });
    });

    test('a request is stored and support hears of it', async () => {
        const sent = app.outbox.length;
        const res = await app.request('POST', '/api/v1/feature-request', { body: request });
        assert.equal(res.status, 201, res.body.message);
        assert.ok(res.body.data.id);
        const mail = app.outbox.slice(sent).find((m) => m.subject === 'New Feature Request');
        assert.equal(mail.to, 'support@glamlink.net');
        assert.match(mail.text, /Niki Capobianco/);
        assert.match(mail.text, /Cover Feature/);
    });

    test('admins list, search and delete requests', async () => {
        assert.equal((await app.request('GET', '/api/v1/feature-request/list')).status, 401);
        const list = await app.request('GET', `/api/v1/feature-request/list?search=${encodeURIComponent(email('niki'))}`, { headers: auth });
        assert.equal(list.body.data.count, 1);
        assert.equal(list.body.data.rows[0].interest, 'Cover Feature');
        const deleted = await app.request('POST', '/api/v1/feature-request/delete', { body: { ids: [list.body.data.rows[0].id] }, headers: auth });
        assert.deepEqual(deleted.body.data, { deleted: 1 });
        assert.equal((await app.request('POST', '/api/v1/feature-request/delete', { body: { ids: [] }, headers: auth })).status, 400);
    });
});

describe('guest application', () => {
    test('keeps the business name and Instagram the website sends as businessName and instagram', async () => {
        const res = await app.request('POST', '/api/v1/guest-application/create', {
            body: { name: 'Guest Gia', businessName: 'Gia Beauty', instagram: '@giabeauty', email: email('gia'), website: 'https://gia.example' },
        });
        assert.equal(res.status, 201, res.body.message);
        const [row] = await q('SELECT business_name, instagram_handle FROM guest_applications WHERE email = ?', [email('gia')]);
        assert.deepEqual(row, { business_name: 'Gia Beauty', instagram_handle: '@giabeauty' });
    });
});
