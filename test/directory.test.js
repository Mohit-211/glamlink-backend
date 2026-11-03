// The directory (Phase 6; Mohit, Oct 23): our profiles (live cards and approved applications) by distance and filters,
// a listing's public page, and Google's listings near the visitor, to claim through the apply form prefilled from
// Google (website/directory; Google replaced by fakes).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const config = require('../src/core/config/config');
const { places, geocoder } = require('../src/integrations/googlePlaces');
const { geocodeLocations } = require('../src/website/access-card');
const directoryService = require('../src/website/directory/directory.service');

let app, q, insert;
const ids = {};
const stamp = `${Date.now()}`.slice(-8);
const realPlaces = { ...places };
const realGeocoder = { ...geocoder };
const calls = { search: 0 };
const VEGAS = { latitude: 36.1699, longitude: -115.1398 };

const PLACES = [
    { place_id: `ChIJ_open_${stamp}`, name: 'Glow Skin Studio', address: '1 Main St, Las Vegas, NV 89101', city: 'Las Vegas', state: 'NV', latitude: 36.17, longitude: -115.15, rating: 4.8, review_count: 120, photo: `places/ChIJ_open_${stamp}/photos/AbC1`, photos: [`places/ChIJ_open_${stamp}/photos/AbC1`], maps_url: 'https://maps.google.com/?cid=1', website: 'https://glow.example', type: 'Skin care clinic', open: true },
    { place_id: `ChIJ_claimed_${stamp}`, name: 'Already Claimed Spa', address: '2 Side St, Las Vegas, NV', city: 'Las Vegas', state: 'NV', latitude: 36.16, longitude: -115.14, rating: 4.1, review_count: 8, photo: null, photos: [], maps_url: null, website: null, type: 'Spa', open: true },
    { place_id: `ChIJ_closed_${stamp}`, name: 'Closed Salon', address: '3 Old Rd, Las Vegas, NV', city: 'Las Vegas', state: 'NV', latitude: 36.15, longitude: -115.13, rating: 3, review_count: 2, photo: null, photos: [], maps_url: null, website: null, type: 'Beauty salon', open: false },
];

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    config.GOOGLE_API_KEY = 'test-key';
    geocoder.geocode = async (address) => ({
        'Las Vegas, NV': { latitude: VEGAS.latitude, longitude: VEGAS.longitude, city: 'Las Vegas', state: 'NV' },
        '89101': { latitude: 36.1716, longitude: -115.1391, city: 'Las Vegas', state: 'NV' },
    })[address] ?? null;
    places.searchText = async ({ text, latitude, limit = 20 }) => {
        calls.search++;
        calls.last = { text, latitude };
        return PLACES.slice(0, limit);
    };
    places.details = async (id) => (id === PLACES[0].place_id
        ? { ...PLACES[0], phone: '(702) 555-0101', hours: ['Monday: 9:00 AM – 5:00 PM', 'Sunday: Closed'], summary: 'Facials and peels.' }
        : null);
    places.photoUri = async (name, width) => `https://lh3.googleusercontent.com/place-photos/${name.split('/').pop()}=s${width}`;

    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (7, 'Professional', 'PRO')");
    const pro = async (name, handle, location, specialties) => {
        const id = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active) VALUES (?, 7, 'professional', 'individual', 'ACCEPTED', 1)", [`${handle}@directory.example`]);
        await insert('INSERT INTO profiles (user_id, email, name) VALUES (?, ?, ?)', [id, `${handle}@directory.example`, name]);
        const card = await insert("INSERT INTO business_cards (user_id, name, status, slug, business_card_link, primary_specialty, specialties) VALUES (?, ?, 'accepted', ?, ?, ?, ?)",
            [id, name, handle, `https://glamlink.net/access/${handle}`, specialties[0], JSON.stringify(specialties)]);
        await insert(`INSERT INTO business_locations (business_card_id, location_type, city, state, latitude, longitude, is_primary) VALUES (?, 'city_only', ?, ?, ?, ?, 1)`,
            [card, location.city, location.state, location.latitude ?? null, location.longitude ?? null]);
        return { id, card };
    };
    ids.vegas = await pro(`Vegas Lashes ${stamp}`, `vegaslashes${stamp}`, { city: 'Las Vegas', state: 'NV' }, ['Lashes', 'Brows']);
    ids.henderson = await pro(`Henderson Skin ${stamp}`, `hendersonskin${stamp}`, { city: 'Henderson', state: 'NV', latitude: 36.0395, longitude: -114.9817 }, ['Facials']);
    const application = (name, status, extra = {}) => insert(
        `INSERT INTO directory_applications (name, email, professional_title, primary_specialty, specialties, bio, phone, locations, city, state, status, place_id, social_media)
         VALUES (?, ?, 'Esthetician', 'Peels', '["Peels"]', 'Calm, clinical skin care.', '7025550000', ?, 'Las Vegas', 'NV', ?, ?, '{"instagram":"https://instagram.com/applicant"}')`,
        [name, `${name.replace(/\W/g, '')}@applicant.example`, JSON.stringify([{ location_type: 'service_area', city: 'Las Vegas', state: 'NV', is_primary: true, phone: '7025551111' }]), status, extra.place ?? null],
    );
    ids.listing = await application(`Applicant Claimer ${stamp}`, 'approved', { place: PLACES[1].place_id });
    ids.pending = await application(`Pending Applicant ${stamp}`, 'pending');
});
after(async () => {
    Object.assign(places, realPlaces);
    Object.assign(geocoder, realGeocoder);
    config.GOOGLE_API_KEY = undefined;
    await app.close();
});

const get = (url) => app.request('GET', `/api/v1${url}`);
const mine = (rows) => rows.filter((row) => row.name.includes(stamp));

describe('coordinates', () => {
    test('card locations and applications without coordinates are geocoded', async () => {
        const result = await geocodeLocations({ business_card_id: ids.vegas.card });
        assert.deepEqual(result, { geocoded: 1, missed: 0 });
        const [location] = await q('SELECT latitude, longitude FROM business_locations WHERE business_card_id = ?', [ids.vegas.card]);
        assert.equal(Number(location.latitude), 36.1699);
        const { geocodeApplication } = require('../src/website/inquiries');
        const { DirectoryApplication } = require('../src/models');
        await geocodeApplication(await DirectoryApplication.findByPk(ids.listing));
        const [listing] = await q('SELECT latitude FROM directory_applications WHERE id = ?', [ids.listing]);
        assert.equal(Number(listing.latitude), 36.1699);
    });
});

describe('our profiles', () => {
    test('near a point: nearest first, cards and approved applications, within the radius', async () => {
        const res = await get(`/directory/search?lat=${VEGAS.latitude}&lng=${VEGAS.longitude}&limit=50`);
        assert.equal(res.status, 200, res.body.message);
        const rows = mine(res.body.data.rows);
        // The listing and the Vegas card stand on the same point (by name), Henderson is farther.
        assert.deepEqual(rows.map((r) => [r.kind, r.name]), [
            ['listing', `Applicant Claimer ${stamp}`], ['profile', `Vegas Lashes ${stamp}`], ['profile', `Henderson Skin ${stamp}`],
        ]);
        const vegas = rows.find((r) => r.kind === 'profile' && r.name.startsWith('Vegas'));
        assert.deepEqual([vegas.slug, vegas.distance_miles], [`vegaslashes${stamp}`, 0]);
        assert.ok(rows.find((r) => r.name.startsWith('Henderson')).distance_miles > 5);
        const near = mine((await get(`/directory/search?lat=${VEGAS.latitude}&lng=${VEGAS.longitude}&radius=5`)).body.data.rows);
        assert.ok(!near.some((r) => r.name.startsWith('Henderson')), 'outside 5 miles');
        assert.ok(!near.some((r) => r.name.startsWith('Pending')), 'pending applications are not listed');
    });

    test('by a typed place, words, a specialty, a city', async () => {
        const typed = mine((await get('/directory/search?location=89101&radius=3')).body.data.rows);
        assert.deepEqual(typed.map((r) => r.name).toSorted(), [`Applicant Claimer ${stamp}`, `Vegas Lashes ${stamp}`]);
        assert.deepEqual(mine((await get('/directory/search?q=lashes')).body.data.rows).map((r) => r.name), [`Vegas Lashes ${stamp}`]);
        assert.deepEqual(mine((await get('/directory/search?specialty=brows')).body.data.rows).map((r) => r.name), [`Vegas Lashes ${stamp}`]);
        assert.deepEqual(mine((await get('/directory/search?city=Henderson')).body.data.rows).map((r) => r.name), [`Henderson Skin ${stamp}`]);
        assert.deepEqual((await get('/directory/search?location=Atlantis')).body.details, { field: 'location' });
    });

    test('an approved application\'s public listing leaves the applicant\'s own contact out', async () => {
        const res = await get(`/directory/listings/${ids.listing}`);
        assert.equal(res.status, 200);
        const l = res.body.data;
        assert.deepEqual([l.name, l.professional_title, l.specialties, l.bio], [`Applicant Claimer ${stamp}`, 'Esthetician', ['Peels'], 'Calm, clinical skin care.']);
        assert.deepEqual(l.social, [{ title: 'Instagram', url: 'https://instagram.com/applicant' }]);
        assert.equal(l.locations[0].phone, '7025551111', 'the business phone the form gave for the location');
        assert.ok(!JSON.stringify(l).includes('@applicant.example') && !JSON.stringify(l).includes('7025550000'));
        assert.equal((await get(`/directory/listings/${ids.pending}`)).status, 404);
    });
});

describe('Google listings', () => {
    test('near the visitor, leaving out claimed and closed ones; photos through the API; asked once a while', async () => {
        directoryService.googleCache.clear();
        const res = await get(`/directory/google?lat=${VEGAS.latitude}&lng=${VEGAS.longitude}&type=esthetician&q=peel`);
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual(res.body.data.rows.map((r) => r.name), ['Glow Skin Studio']);
        const place = res.body.data.rows[0];
        assert.match(place.photo_url, /\/api\/v1\/directory\/google\/photo\?name=places%2FChIJ_open_\d+%2Fphotos%2FAbC1&w=400$/);
        assert.ok(place.distance_miles < 1);
        assert.deepEqual(calls.last, { text: 'peel esthetician', latitude: VEGAS.latitude });
        const searchesBefore = calls.search;
        await get(`/directory/google?lat=${VEGAS.latitude}&lng=${VEGAS.longitude}&type=esthetician&q=peel`);
        assert.equal(calls.search, searchesBefore, 'the same search is not paid twice');
        assert.deepEqual((await get('/directory/google?type=esthetician')).body.details, { field: 'location' });
        assert.deepEqual((await get(`/directory/google?lat=1&lng=1&type=barber`)).body.details, { field: 'type' });
    });

    test('the apply form finds a business on Google and is prefilled from it', async () => {
        const found = await get('/directory/google/search?q=Glow%20Skin%20Studio%20Las%20Vegas');
        assert.deepEqual(found.body.data.map((p) => [p.name, p.claimed]).slice(0, 2), [['Glow Skin Studio', false], ['Already Claimed Spa', true]]);
        const res = await get(`/directory/google/places/${PLACES[0].place_id}`);
        assert.equal(res.status, 200, res.body.message);
        const { form } = res.body.data;
        assert.deepEqual([form.place_id, form.phone, form.website, form.bio], [PLACES[0].place_id, '(702) 555-0101', 'https://glow.example', 'Facials and peels.']);
        assert.deepEqual(form.locations[0], {
            label: 'Glow Skin Studio', location_type: 'exact_address', address: '1 Main St, Las Vegas, NV 89101', city: 'Las Vegas', state: 'NV',
            business_name: 'Glow Skin Studio', phone: '(702) 555-0101', description: '', is_primary: true, sort_order: 1,
        });
        assert.deepEqual(form.business_hours, [{ note: 'Monday: 9:00 AM – 5:00 PM' }, { note: 'Sunday: Closed' }]);
        assert.equal((await get('/directory/google/places/ChIJ_unknown_place')).status, 404);
    });

    test('a photo redirects to Google\'s own link; our key never leaves the server', async () => {
        const res = await fetch(`${app.base}/api/v1/directory/google/photo?name=${encodeURIComponent(`places/ChIJ_open_${stamp}/photos/AbC1`)}&w=300`, { redirect: 'manual' });
        assert.equal(res.status, 302);
        assert.equal(res.headers.get('location'), 'https://lh3.googleusercontent.com/place-photos/AbC1=s400');
        assert.ok(!res.headers.get('location').includes('test-key'));
        assert.equal((await get('/directory/google/photo?name=https://evil.example/x')).status, 400);
    });

    test('without a Google key the directory says so', async () => {
        config.GOOGLE_API_KEY = '';
        directoryService.googleCache.clear();
        const res = await get(`/directory/google?lat=${VEGAS.latitude}&lng=${VEGAS.longitude}`);
        config.GOOGLE_API_KEY = 'test-key';
        assert.deepEqual([res.status, res.body.code], [503, 'GOOGLE_NOT_CONFIGURED']);
    });
});

describe('professionals and brands (Nov 1)', () => {
    test('the nearby search asks for professionals or brands; brands have their own list', async () => {
        await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (8, 'Brand', 'BRND')");
        const email = `vegasbrand${stamp}@directory.example`;
        const id = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active) VALUES (?, 8, 'professional', 'brand', 'ACCEPTED', 1)", [email]);
        await insert('INSERT INTO profiles (user_id, email, name) VALUES (?, ?, ?)', [id, email, `Vegas Brand ${stamp}`]);
        const card = await insert("INSERT INTO business_cards (user_id, name, business_name, professional_type, status, slug, business_card_link) VALUES (?, ?, ?, 'brand', 'accepted', ?, ?)",
            [id, `Vegas Brand ${stamp}`, `Vegas Brand ${stamp}`, `vegasbrand${stamp}`, `https://glamlink.net/access/vegasbrand${stamp}`]);
        await insert("INSERT INTO business_locations (business_card_id, location_type, city, state, latitude, longitude, is_primary) VALUES (?, 'city_only', 'Las Vegas', 'NV', ?, ?, 1)",
            [card, VEGAS.latitude, VEGAS.longitude]);
        const near = async (type = '') => mine((await get(`/directory/search?lat=${VEGAS.latitude}&lng=${VEGAS.longitude}&limit=50${type && `&type=${type}`}`)).body.data.rows)
            .map((r) => [r.name, r.type]);
        assert.ok((await near()).some(([name]) => name === `Vegas Brand ${stamp}`));
        assert.ok(!(await near('individual')).some(([name]) => name === `Vegas Brand ${stamp}`));
        assert.ok((await near('individual')).every(([, type]) => type === 'individual'));
        assert.deepEqual(await near('brand'), [[`Vegas Brand ${stamp}`, 'brand']]);
        assert.deepEqual((await get('/directory/search?type=salon')).body.details, { field: 'type' });
    });
});

describe('typed addresses placed in Las Vegas (Nov 1)', () => {
    test('the migration clears the old fallback pair on exact addresses, so they are geocoded again; cities keep it', async () => {
        const typed = await insert("INSERT INTO business_locations (business_card_id, location_type, address, latitude, longitude, is_primary) VALUES (?, 'exact_address', '12 Elm St, Boise, ID', 36.1699, -115.1398, 0)", [ids.vegas.card]);
        const city = await insert("INSERT INTO business_locations (business_card_id, location_type, city, state, latitude, longitude, is_primary) VALUES (?, 'city_only', 'Las Vegas', 'NV', 36.1699, -115.1398, 0)", [ids.vegas.card]);
        await require('../src/core/db/migrations/20261101-0300-unplace-typed-addresses').up({ sequelize: app.sequelize });
        const [a] = await q('SELECT latitude, longitude FROM business_locations WHERE id = ?', [typed]);
        const [b] = await q('SELECT latitude FROM business_locations WHERE id = ?', [city]);
        assert.deepEqual([a.latitude, a.longitude], [null, null]);
        assert.equal(Number(b.latitude), 36.1699);
        await q('DELETE FROM business_locations WHERE id IN (?, ?)', [typed, city]);
    });
});

describe('claims made through the Access form (Nov 1)', () => {
    let admin, claimant;
    const card = (name, placeId) => insert("INSERT INTO business_cards (name, email, status, slug, business_card_link, claimed_place_id) VALUES (?, ?, 'draft', ?, ?, ?)",
        [name, `${name.replace(/\W/g, '')}@claim.example`, name.replace(/\W/g, '').toLowerCase(), `https://glamlink.net/access/${name.replace(/\W/g, '').toLowerCase()}`, placeId]);
    const googleNames = async () => {
        directoryService.googleCache.clear();
        return (await get(`/directory/google?lat=${VEGAS.latitude}&lng=${VEGAS.longitude}`)).body.data.rows.map((r) => r.name);
    };
    const review = (id, action) => app.request('PUT', `/api/v1/directory/claims/${id}`, { body: { action }, headers: admin });
    before(async () => {
        await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM')");
        const adminId = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Claims Admin', ?, 1, 1)", [`claims-admin-${stamp}@test.example`]);
        admin = { Authorization: `Bearer ${jwt.sign({ id: adminId, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
        claimant = await card(`Glow Owner ${stamp}`, PLACES[0].place_id);
    });

    test('until an admin verifies it, the Google listing stays; admins see the claims to check first', async () => {
        assert.ok((await googleNames()).includes('Glow Skin Studio'));
        assert.equal((await get('/directory/claims')).status, 401);
        const res = await app.request('GET', '/api/v1/directory/claims?status=pending', { headers: admin });
        assert.equal(res.status, 200, res.body.message);
        const row = res.body.data.rows.find((r) => r.business_card_id === claimant);
        assert.deepEqual([row.place_id, row.verified_at], [PLACES[0].place_id, null]);
        assert.match(row.maps_url, /place_id:/);
    });

    test('a verified claim takes the listing out; no second card can have it; a rejected claim is cleared', async () => {
        const verified = await review(claimant, 'verify');
        assert.equal(verified.status, 200, verified.body.message);
        assert.ok(verified.body.data.verified_at);
        assert.ok(!(await googleNames()).includes('Glow Skin Studio'));
        const rival = await card(`Glow Rival ${stamp}`, PLACES[0].place_id);
        const refused = await review(rival, 'verify');
        assert.deepEqual([refused.status, refused.body.code], [409, 'PLACE_ALREADY_CLAIMED']);
        assert.equal((await review(rival, 'reject')).status, 200);
        assert.equal((await q('SELECT claimed_place_id FROM business_cards WHERE id = ?', [rival]))[0].claimed_place_id, null);
        assert.equal((await review(rival, 'verify')).status, 404, 'nothing left to verify');
        assert.equal((await review(claimant, 'keep')).status, 400);
    });
});
