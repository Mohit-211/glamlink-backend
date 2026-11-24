// "Fetch info from Google" on the Access card form (Mohit, Nov 24): a search bar on Places Autocomplete (New) as the
// person types, then the chosen listing as the card form's own fields, which replace what was typed; the card keeps the
// listing's place id, and while the card is live that Google listing leaves the directory's Google results (verified
// or not). Owners claim from any edit, on any plan. Google replaced by fakes (website/directory, website/access-card).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');
const { cardFields, cardFiles } = require('./cardFixtures');
const config = require('../src/core/config/config');
const { places } = require('../src/integrations/googlePlaces');
const directoryService = require('../src/website/directory/directory.service');

let app, q, insert, owner, entitlements;
const stamp = `${Date.now()}`.slice(-8);
const realPlaces = { ...places };
const realKey = config.GOOGLE_API_KEY;
const calls = { autocomplete: [], details: [] };
const SESSION = '0b6f2c1e-6a3e-4c55-9d8e-1f2a3b4c5d6e';
const VEGAS = 'lat=36.17&lng=-115.14';

const listing = (id, fields) => ({
    place_id: id, city: 'Las Vegas', state: 'NV', rating: 4.8, review_count: 10, photo: null, photos: [], maps_url: null, type: 'Beauty salon', open: true, ...fields,
});
const LUXE = listing(`ChIJ_luxe_${stamp}`, {
    name: 'Luxe Lash Lounge', address: '200 S Las Vegas Blvd, Las Vegas, NV 89101, USA', latitude: 36.1691, longitude: -115.1405,
    website: 'https://luxelash.example/', phone: '(702) 555-0142', hours: ['Monday: 9:00 AM – 6:00 PM', 'Tuesday: Closed'], summary: 'Lash extensions and lifts.',
});
const BROW = listing(`ChIJ_brow_${stamp}`, { name: 'Brow Bar', address: '9 Fremont St, Las Vegas, NV 89101, USA', latitude: 36.17, longitude: -115.143, website: null, phone: null, hours: [], summary: null });
const LONDON = listing(`ChIJ_london_${stamp}`, {
    name: 'Mayfair Skin', address: '1 Bond St, London, UK', city: 'London', state: null, latitude: 51.51, longitude: -0.14,
    website: 'ftp://mayfair.example', phone: '+44 20 7946 0958', hours: [], summary: 'A clinic for facials, peels and light treatments in the heart of Mayfair, open late on weekdays.',
});

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    config.GOOGLE_API_KEY = 'test-key';
    places.autocomplete = async (args) => {
        calls.autocomplete.push(args);
        return [{ place_id: LUXE.place_id, name: LUXE.name, address: 'South Las Vegas Boulevard, Las Vegas, NV, USA' }, { place_id: BROW.place_id, name: BROW.name, address: 'Fremont Street, Las Vegas, NV, USA' }];
    };
    places.details = async (id, { sessionToken } = {}) => {
        calls.details.push([id, sessionToken]);
        return [LUXE, BROW, LONDON].find((place) => place.place_id === id) ?? null;
    };
    places.searchText = async () => [LUXE, BROW];

    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (7, 'Professional', 'PRO')");
    const { createSession } = require('../src/shared/identity');
    const id = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active, email_verified_at) VALUES (?, 7, 'professional', 'individual', 'ACCEPTED', 1, NOW())",
        [`luxe-${stamp}@owner.example`]);
    const token = (await createSession({ id }, { client: 'test' })).tokens.access_token;
    const res = await app.form('POST', '/api/v1/businessCard/createBusinessCard', { fields: cardFields(), files: cardFiles(), token });
    assert.equal(res.status, 201, res.body.message);
    owner = { id, token, cardId: res.body.data.id };
    await q("UPDATE business_cards SET status = 'accepted' WHERE id = ?", [owner.cardId]);
    [{ value: entitlements }] = await q("SELECT value FROM access_settings WHERE setting = 'entitlements'");
});
after(async () => {
    await q("UPDATE access_settings SET value = ? WHERE setting = 'entitlements'", [entitlements]);
    Object.assign(places, realPlaces);
    config.GOOGLE_API_KEY = realKey;
    await app.close();
});

const get = (url) => app.request('GET', `/api/v1${url}`);
const edit = (fields) => app.form('PUT', `/api/v1/businessCard/updateBusinessCard/${owner.cardId}`, { fields, files: {}, token: owner.token });
const field = async (query) => (await get(`/directory/google/autocomplete?${query}`)).body.details?.field;
const claimOf = async () => (await q('SELECT claimed_place_id, claim_verified_at FROM business_cards WHERE id = ?', [owner.cardId]))[0];
const googleNames = async () => {
    directoryService.googleCache.clear();
    return (await get(`/directory/google?${VEGAS}`)).body.data.rows.map((r) => r.name);
};

describe('the search bar', () => {
    test('businesses as the person types, near them, in one session; asked once a while', async () => {
        directoryService.googleCache.clear();
        const res = await get(`/directory/google/autocomplete?q=luxe%20lash&session=${SESSION}&${VEGAS}`);
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual(res.body.data, {
            count: 2,
            rows: [
                { place_id: LUXE.place_id, name: 'Luxe Lash Lounge', address: 'South Las Vegas Boulevard, Las Vegas, NV, USA', claimed: false },
                { place_id: BROW.place_id, name: 'Brow Bar', address: 'Fremont Street, Las Vegas, NV, USA', claimed: false },
            ],
        });
        assert.deepEqual(calls.autocomplete.at(-1), { input: 'luxe lash', sessionToken: SESSION, latitude: 36.17, longitude: -115.14 });
        await get(`/directory/google/autocomplete?q=Luxe%20Lash&session=${SESSION}&${VEGAS}`);
        assert.equal(calls.autocomplete.length, 1, 'the same words near the same place are not paid twice');
    });

    test('refusals name the field', async () => {
        assert.equal(await field('q=l'), 'q');
        assert.equal(await field('q=luxe&session=not%20a%20token!'), 'session');
        assert.equal(await field('q=luxe&lat=36.1'), 'lng');
    });
});

describe('the chosen listing as the card form\'s fields', () => {
    test('what Google knows, in the card\'s own fields; the details call ends the session', async () => {
        const res = await get(`/directory/google/places/${LUXE.place_id}?session=${SESSION}`);
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual(calls.details.at(-1), [LUXE.place_id, SESSION]);
        assert.deepEqual(res.body.data.card, {
            claimed_place_id: LUXE.place_id,
            business_name: 'Luxe Lash Lounge',
            phone: '7025550142',
            website: 'https://luxelash.example/',
            bio: 'Lash extensions and lifts.',
            locations: [{
                label: 'Luxe Lash Lounge', location_type: 'exact_address', address: '200 S Las Vegas Blvd, Las Vegas, NV 89101, USA', city: 'Las Vegas', state: 'NV',
                latitude: 36.1691, longitude: -115.1405, is_primary: true,
            }],
            business_hour: [{ note: 'Monday: 9:00 AM – 6:00 PM' }, { note: 'Tuesday: Closed' }],
        });
        assert.equal(res.body.data.form.place_id, LUXE.place_id, 'the older form fields stay');
    });

    test('what the card cannot take is left for the person: a phone outside the US and Canada, a summary over 80 characters, a link that is not a web link', async () => {
        const { card } = (await get(`/directory/google/places/${LONDON.place_id}`)).body.data;
        assert.deepEqual([card.phone, card.bio, card.website, card.business_name], [null, null, null, 'Mayfair Skin']);
        assert.deepEqual(calls.details.at(-1), [LONDON.place_id, undefined], 'no session: a lone details call');
        const empty = (await get(`/directory/google/places/${BROW.place_id}`)).body.data.card;
        assert.deepEqual([empty.phone, empty.website, empty.bio, empty.business_hour], [null, null, null, []]);
    });
});

describe('the card takes the listing', () => {
    test('saved from the form, the card has Google\'s details and point, and the live card\'s claim takes the listing out at once', async () => {
        assert.ok((await googleNames()).includes('Luxe Lash Lounge'));
        const { card } = (await get(`/directory/google/places/${LUXE.place_id}`)).body.data;
        const res = await edit({
            business_name: card.business_name, phone: card.phone, website: card.website, bio: card.bio,
            locations: card.locations, business_hour: card.business_hour, claimed_place_id: card.claimed_place_id,
        });
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual(await claimOf(), { claimed_place_id: LUXE.place_id, claim_verified_at: null });
        const [saved] = await q('SELECT business_name, phone, website FROM business_cards WHERE id = ?', [owner.cardId]);
        assert.deepEqual(saved, { business_name: 'Luxe Lash Lounge', phone: '7025550142', website: 'https://luxelash.example/' });
        const locations = await q('SELECT address, latitude, longitude, is_primary FROM business_locations WHERE business_card_id = ? AND deleted_at IS NULL', [owner.cardId]);
        assert.deepEqual(locations.map((l) => [l.address, Number(l.latitude), Number(l.longitude), l.is_primary]),
            [['200 S Las Vegas Blvd, Las Vegas, NV 89101, USA', 36.1691, -115.1405, 1]], 'Google\'s point: nothing to geocode');
        assert.equal((await q('SELECT COUNT(*) AS n FROM business_hours WHERE business_card_id = ? AND deleted_at IS NULL', [owner.cardId]))[0].n, 2);

        assert.ok(!(await googleNames()).includes('Luxe Lash Lounge'), 'out before any admin looked');
        directoryService.googleCache.clear();
        const typed = (await get(`/directory/google/autocomplete?q=luxe&session=${SESSION}`)).body.data.rows;
        assert.equal(typed.find((r) => r.place_id === LUXE.place_id).claimed, true);
    });

    test('claiming is not a change of details: a Free owner whose plan locks details still claims; another listing needs verifying again; "" withdraws', async () => {
        const locked = JSON.parse(entitlements);
        locked.free = { ...locked.free, edit_details: false };
        await q("UPDATE access_settings SET value = ? WHERE setting = 'entitlements'", [JSON.stringify(locked)]);
        await q('UPDATE business_cards SET claim_verified_at = NOW() WHERE id = ?', [owner.cardId]);

        const same = await edit({ claimed_place_id: LUXE.place_id });
        assert.equal(same.status, 200, same.body.message);
        assert.ok((await claimOf()).claim_verified_at, 'the same listing changes nothing');

        const other = await edit({ claimed_place_id: BROW.place_id });
        assert.equal(other.status, 200, other.body.message);
        assert.deepEqual(await claimOf(), { claimed_place_id: BROW.place_id, claim_verified_at: null });
        const names = await googleNames();
        assert.ok(names.includes('Luxe Lash Lounge') && !names.includes('Brow Bar'));

        const details = await edit({ business_name: 'Brow Bar' });
        assert.deepEqual([details.status, details.body.code], [403, 'UPGRADE_REQUIRED'], 'the details themselves stay locked');

        assert.equal((await edit({ claimed_place_id: '' })).status, 200);
        assert.deepEqual(await claimOf(), { claimed_place_id: null, claim_verified_at: null });
        assert.ok((await googleNames()).includes('Brow Bar'));
        assert.deepEqual((await edit({ claimed_place_id: 'x' })).body.details, { field: 'claimed_place_id' });
    });
});
