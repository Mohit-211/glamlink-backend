// Off the directory map (Mohit, Nov 24): an admin takes a professional's pin off the hero map (GET /directory/map);
// their page, the directory's list and the Professionals page still show them. Owners cannot change it.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');

let app, q, insert, auth, ownerToken, proId;
const stamp = `${Date.now()}`.slice(-8);
const name = `Pin Pro ${stamp}`;
const slug = `pinpro${stamp}`;
// A box around Missoula, Montana, where no other test puts a pin.
const BOX = 'north=47.0&south=46.7&east=-113.8&west=-114.2';

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (7, 'Professional', 'PRO')");
    proId = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active, password) VALUES (?, 7, 'professional', 'individual', 'ACCEPTED', 1, 'x')",
        [`pin-${stamp}@pro.example`]);
    await insert('INSERT INTO profiles (user_id, email, name) VALUES (?, ?, ?)', [proId, `pin-${stamp}@pro.example`, name]);
    const card = await insert("INSERT INTO business_cards (user_id, name, status, slug, business_card_link, primary_specialty) VALUES (?, ?, 'accepted', ?, ?, 'Facials')",
        [proId, name, slug, `https://glamlink.net/access/${slug}`]);
    await insert("INSERT INTO business_locations (business_card_id, location_type, city, state, latitude, longitude, is_primary) VALUES (?, 'city_only', 'Missoula', 'MT', 46.8721, -113.994, 1)", [card]);
    const { createSession } = require('../src/shared/identity');
    ownerToken = (await createSession({ id: proId }, { client: 'test' })).tokens.access_token;
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Map Admin', ?, 1, 1)", [`map-admin-${stamp}@test.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
});
after(() => app.close());

const pins = async () => (await app.request('GET', `/api/v1/directory/map?${BOX}`)).body.data.rows.map((r) => r.slug);
const adminList = async (onMap) =>
    (await app.request('GET', `/api/v1/profiles/admin/list?type=individual&search=${encodeURIComponent(name)}&on_map=${onMap}`, { headers: auth })).body.data.rows.map((r) => [r.id, r.is_on_map]);

test('the pin shows until an admin takes it off; the owner cannot', async () => {
    assert.deepEqual(await pins(), [slug]);
    const own = await app.request('PUT', '/api/v1/my/profile', { body: { is_on_map: false, tagline: 'Facials' }, token: ownerToken });
    assert.equal(own.status, 200, own.body.message);
    assert.equal(own.body.data.page.is_on_map, true, 'an owner\'s is_on_map is not read');
    assert.deepEqual(await pins(), [slug]);

    const off = await app.request('PUT', `/api/v1/profiles/admin/${proId}`, { body: { is_on_map: false }, headers: auth });
    assert.equal(off.status, 200, off.body.message);
    assert.equal(off.body.data.page.is_on_map, false);
    assert.deepEqual(await pins(), []);
    assert.deepEqual(await adminList('false'), [[proId, false]]);
    assert.deepEqual(await adminList('true'), []);
});

test('off the map, the page and the lists still show them', async () => {
    assert.equal((await app.request('GET', `/api/v1/profiles/${slug}`)).status, 200);
    const directory = await app.request('GET', `/api/v1/directory/search?q=${encodeURIComponent(name)}`);
    assert.deepEqual(directory.body.data.rows.map((r) => r.slug), [slug]);
    const professionals = await app.request('GET', `/api/v1/profiles?type=individual&search=${encodeURIComponent(name)}`);
    assert.deepEqual(professionals.body.data.rows.map((r) => r.slug), [slug]);
    // An owner's own edits keep the admin's choice.
    assert.equal((await app.request('PUT', '/api/v1/my/profile', { body: { tagline: 'Peels' }, token: ownerToken })).status, 200);
    assert.deepEqual(await pins(), []);
});

test('an admin puts the pin back', async () => {
    const on = await app.request('PUT', `/api/v1/profiles/admin/${proId}`, { body: { is_on_map: 'true' }, headers: auth });
    assert.equal(on.body.data.page.is_on_map, true);
    assert.deepEqual(await pins(), [slug]);
});
