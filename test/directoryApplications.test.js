// The directory application form (Phase 6): POST /directory/applications keeps the form's fields as sent, apart
// from Access cards and their rules; admins list, review and delete applications (website/inquiries).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const { photo } = require('./cardFixtures');
const config = require('../src/core/config/config');
const { UPLOADS_DIR } = require('../src/core/config/paths');

let app, auth;
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const applicantEmail = `applicant-${stamp}@test.example`;

before(async () => {
    app = await startApp();
    const q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM')");
    const res = await q("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Directory Admin', ?, 1, 1)", [`dir-admin-${stamp}@test.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: res.insertId ?? res, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
});
after(() => app.close());

// What /directory-form-apply sends, with the API's file fields (profile_image, images).
const formFields = (overrides = {}) => ({
    name: 'Kate Sue',
    professional_title: 'Makeup Artist',
    email: applicantEmail,
    phone: '(702) 677-4576',
    bio: 'Kate has done bridal and editorial makeup in Las Vegas for twelve years. She trained in Paris and London, '
        + 'teaches airbrush classes, and books out months ahead for wedding season, so plan early.',
    custom_handle: '@katesue_bee',
    social_media: { instagram: 'https://www.instagram.com/katesue', tiktok: '' },
    preferred_booking_method: 'Walk-ins welcome',
    primary_specialty: 'Makeup',
    specialties: ['Bridal', 'Editorial'],
    locations: [
        { label: 'Studio', location_type: 'service_area', address: '', city: 'Las Vegas', state: 'NV', business_name: 'Kate Sue Beauty', phone: '', description: 'Travels within 30 miles', is_primary: true, sort_order: 1 },
        { label: 'Online', location_type: 'virtual', address: '', city: '', state: '', business_name: '', phone: '', description: '', is_primary: false, sort_order: 2 },
    ],
    business_hours: [{ note: 'Hours: By Appointment Only' }],
    gallery_meta: [{ caption: 'Bridal look', is_thumbnail: true, sort_order: 1 }, { caption: 'Editorial', is_thumbnail: false, sort_order: 2 }],
    offer_promotion: 'true',
    promotion_details: '20% off first booking',
    elite_setup: 'false',
    excites_about_glamlink: ['Community & networking with other pros'],
    biggest_pain_points: ['No shows'],
    createAccessCard: 'true',
    place_id: 'ChIJ-test-place',
    ...overrides,
});
const apply = (fields = formFields(), files = { profile_image: [photo('me.png')], images: [photo('one.png'), photo('two.png')] }) =>
    app.form('POST', '/api/v1/directory/applications', { fields, files });
const fileOf = (url) => path.join(UPLOADS_DIR, ...url.slice(config.API_BASE_URL.replace(/\/+$/, '').length + 1).split('/'));

let applicationId;

describe('applying', () => {
    test('keeps the form as sent: a long bio, walk-ins, service-area and virtual locations; support hears of it', async () => {
        const sent = app.outbox.length;
        const res = await apply();
        assert.equal(res.status, 201, res.body.message);
        assert.equal(res.body.data.status, 'pending');
        applicationId = res.body.data.id;

        const shown = await app.request('GET', `/api/v1/directory/applications/${applicationId}`, { headers: auth });
        assert.equal(shown.status, 200);
        const a = shown.body.data;
        assert.equal(a.bio.length > 80, true);
        assert.equal(a.preferred_booking_method, 'Walk-ins welcome');
        assert.deepEqual(a.locations.map((l) => l.location_type), ['service_area', 'virtual']);
        assert.deepEqual(a.specialties, ['Bridal', 'Editorial']);
        assert.equal(a.social_media.instagram, 'https://www.instagram.com/katesue');
        assert.equal(a.wants_access_card, true);
        assert.equal(a.offer_promotion, true);
        assert.equal(a.elite_setup, false);
        assert.equal(a.place_id, 'ChIJ-test-place');
        assert.match(a.profile_image, /\/images\//);
        assert.deepEqual(a.gallery.map((g) => [g.caption, g.is_thumbnail, g.sort_order]), [['Bridal look', true, 1], ['Editorial', false, 2]]);
        assert.ok(fs.existsSync(fileOf(a.gallery[0].url)));

        const mail = app.outbox.slice(sent).find((m) => m.subject === 'New Directory Application');
        assert.equal(mail.to, 'support@glamlink.net');
        assert.match(mail.text, /Kate Sue/);
    });

    test('needs a name and a valid email; lists must be JSON; at most 10 photos', async () => {
        assert.deepEqual((await apply(formFields({ name: '' }))).body.details, { field: 'name' });
        assert.deepEqual((await apply(formFields({ email: 'kate@' }))).body.details, { field: 'email' });
        assert.deepEqual((await apply(formFields({ locations: 'Las Vegas' }))).body.details, { field: 'locations' });
        const many = await apply(formFields(), { images: Array.from({ length: 11 }, (_, i) => photo(`p${i}.png`)) });
        assert.equal(many.status, 400);
        assert.deepEqual(many.body.details, { field: 'images' });
    });

    test('the form\'s old file fields are refused: the photos go as profile_image and images', async () => {
        const res = await apply(formFields(), { profilePhoto: [photo('me.png')] });
        assert.equal(res.status, 400);
    });
});

describe('reviewing', () => {
    test('only admins see applications', async () => {
        assert.equal((await app.request('GET', '/api/v1/directory/applications')).status, 401);
        assert.equal((await app.request('GET', `/api/v1/directory/applications/${applicationId}`)).status, 401);
    });

    test('admins list and search them, approve one with a note, and delete it with its photos', async () => {
        const list = await app.request('GET', `/api/v1/directory/applications?status=pending&search=${encodeURIComponent(applicantEmail)}`, { headers: auth });
        assert.equal(list.status, 200);
        assert.deepEqual(list.body.data.rows.map((r) => r.id), [applicationId]);

        assert.equal((await app.request('PUT', `/api/v1/directory/applications/${applicationId}/status`, { body: { status: 'live' }, headers: auth })).status, 400);
        const approved = await app.request('PUT', `/api/v1/directory/applications/${applicationId}/status`, { body: { status: 'approved', note: 'Checked her Instagram' }, headers: auth });
        assert.equal(approved.status, 200, approved.body.message);
        assert.equal(approved.body.data.status, 'approved');
        assert.equal(approved.body.data.review_note, 'Checked her Instagram');
        assert.ok(approved.body.data.reviewed_at);
        const pending = await app.request('GET', `/api/v1/directory/applications?status=pending&search=${encodeURIComponent(applicantEmail)}`, { headers: auth });
        assert.equal(pending.body.data.count, 0);

        const files = [approved.body.data.profile_image, ...approved.body.data.gallery.map((g) => g.url)].map(fileOf);
        assert.ok(files.every((f) => fs.existsSync(f)));
        const deleted = await app.request('POST', '/api/v1/directory/applications/delete', { body: { ids: [applicationId] }, headers: auth });
        assert.deepEqual(deleted.body.data, { deleted: 1 });
        assert.equal((await app.request('GET', `/api/v1/directory/applications/${applicationId}`, { headers: auth })).status, 404);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.ok(files.every((f) => !fs.existsSync(f)), 'the photos are removed too');
    });
});
