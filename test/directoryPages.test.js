// The Directory, Professionals and Brands pages (Mohit, Nov 3): GET /profiles in more orders (recommended, newest,
// nearest) and filtered (a specialty, a state written either way, a city, a brand's category and shipping, miles from
// the visitor); GET /directory/filters, each option with as many pages as the list finds for it; and the hero map's
// pins, GET /directory/map (website/profiles, website/directory).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');
const { STATES, stateCode, stateName } = require('../src/core/utils/usStates');

let app, q, insert;
const ids = {}; // accounts, by label
const stamp = `${Date.now()}`.slice(-8);
const S = (text) => `${text} ${stamp}`;
// The visitor, in Burlington, Vermont, and a box around Vermont.
const HERE = 'lat=44.4759&lng=-73.2121';
const VERMONT = 'north=45.1&south=42.7&east=-71.4&west=-73.6';

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (7, 'Professional', 'PRO'), (8, 'Brand', 'BRND')");

    // An account made on `created`, with a row of its page's own fields when `page` is given.
    const account = async (label, name, { type = 'individual', created = '2026-01-01', page } = {}) => {
        const email = `${label}-${stamp}@pages.example`;
        ids[label] = await insert(
            "INSERT INTO users (email, role_id, account_type, professional_type, status, is_active, created_at) VALUES (?, ?, 'professional', ?, 'ACCEPTED', 1, ?)",
            [email, type === 'brand' ? 8 : 7, type, created],
        );
        await insert('INSERT INTO profiles (user_id, email, name) VALUES (?, ?, ?)', [ids[label], email, name]);
        if (page) {
            await insert(
                `INSERT INTO profile_pages (user_id, slug, is_listed, is_featured, featured_order, created_by_admin, category, shipping)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [ids[label], page.slug ?? null, page.listed ?? 1, page.featured ?? 0, page.order ?? 0, page.admin ?? 0, page.category ?? null, page.shipping ?? null],
            );
        }
        return ids[label];
    };
    // An account with a live card: its specialties, and its main location { city, state, at: [latitude, longitude] }.
    const pro = async (label, name, { primary = null, specialties = null, place, business = null, ...options } = {}) => {
        const id = await account(label, name, options);
        const card = await insert(
            "INSERT INTO business_cards (user_id, name, business_name, status, slug, primary_specialty, specialties) VALUES (?, ?, ?, 'accepted', ?, ?, ?)",
            [id, name, business, `${label}${stamp}`, primary, specialties && JSON.stringify(specialties)],
        );
        if (place) {
            await insert(
                "INSERT INTO business_locations (business_card_id, location_type, city, state, latitude, longitude, is_primary) VALUES (?, 'city_only', ?, ?, ?, ?, 1)",
                [card, place.city ?? null, place.state ?? null, place.at?.[0] ?? null, place.at?.[1] ?? null],
            );
        }
        return id;
    };

    // Professionals. The esthetician is spelled four ways: a card's primary specialty, a page's category, an entry of a
    // card's list with spaces around it.
    await pro('ava', S('Ava'), {
        created: '2026-03-01', primary: S('Esthetician'), specialties: [S('Esthetician'), S('Lash Lift')],
        place: { city: 'Burlington', state: 'VT', at: [44.4759, -73.2121] }, page: { featured: 1, order: 2 },
    });
    await pro('bea', S('Bea'), {
        created: '2026-05-01', primary: S('Facialist'), specialties: [S('Facialist')],
        place: { city: 'burlington ', state: 'Vermont', at: [44.491234, -73.181987] }, page: { featured: 1, order: 1, category: S('esthetician') },
    });
    await pro('cy', S('Cy'), {
        created: '2026-05-01', primary: S('Nails'), specialties: [` ${S('ESTHETICIAN')} `, S('Nails'), '', '   '],
        place: { city: 'Montpelier', state: 'vt', at: [44.26, -72.575] }, page: { featured: 0, order: -1 },
    });
    // A page made from an approved listing (no card), in Toronto; its list has an entry too long to filter by.
    await account('dee', S('Dee'), { created: '2026-02-01', page: { slug: `dee-${stamp}` } });
    await insert(
        `INSERT INTO directory_applications (name, email, user_id, primary_specialty, specialties, city, state, latitude, longitude, status)
         VALUES (?, ?, ?, ?, ?, 'Toronto', 'Ontario', 43.6532, -79.3832, 'approved')`,
        [S('Dee'), `dee-${stamp}@listing.example`, ids.dee, S('Brows'), JSON.stringify([S('Brows'), 'x'.repeat(101)])],
    );
    // A state without a city or a point; no location at all.
    await pro('eve', S('Eve'), { created: '2026-04-01', primary: S('Esthetician'), specialties: [S('Esthetician')], place: { state: 'VT' } });
    await pro('fay', S('Fay'), { created: '2026-04-01', primary: S('Makeup'), specialties: [S('Makeup')] });
    await pro('nia', S('Nia'), { primary: S('Hair'), specialties: [S('Hair')], place: { city: 'Las Vegas', state: 'Nevada', at: [36.1699, -115.1398] } });
    await pro('noa', S('Noa'), { primary: S('hair'), specialties: [S('hair'), S('makeup')], place: { city: 'las vegas', state: 'nv' } });
    // Two pages of one name, made at one time, in one place.
    for (const label of ['twin1', 'twin2']) {
        await pro(label, S('Twin'), { created: '2026-06-01', primary: S('Hair'), specialties: [S('Hair')], place: { city: 'Rutland', state: 'VT', at: [43.6106, -72.9726] } });
    }
    // Counted nowhere: an unlisted page, and an approved listing without an account (the directory search has it).
    await pro('hidden', S('Hidden'), {
        primary: S('Esthetician'), specialties: [S('Esthetician')], place: { city: 'Burlington', state: 'VT', at: [44.4759, -73.2121] }, page: { listed: 0 },
    });
    await insert(
        `INSERT INTO directory_applications (name, email, primary_specialty, specialties, city, state, latitude, longitude, status)
         VALUES (?, ?, ?, ?, 'Burlington', 'VT', 44.4759, -73.2121, 'approved')`,
        [S('Loose Listing'), `loose-${stamp}@listing.example`, S('Esthetician'), JSON.stringify([S('Esthetician')])],
    );

    // Brands: one with a card (in Burlington, but no pin: pins are professionals), an admin's page, one with neither set.
    await pro('glow', S('Glow'), {
        type: 'brand', business: S('Glow'), place: { city: 'Burlington', state: 'VT', at: [44.4759, -73.2121] }, page: { category: 'skincare', shipping: 'nationwide' },
    });
    await account('hue', S('Hue'), { type: 'brand', page: { slug: `hue-${stamp}`, admin: 1, category: 'makeup', shipping: 'local' } });
    await pro('ivy', S('Ivy'), { type: 'brand', business: S('Ivy') });
});
// Other tests read the first pages by name: this file's pages and listings go (cards, locations and page rows with
// their accounts).
after(async () => {
    await q('DELETE FROM directory_applications WHERE email IN (?)', [[`dee-${stamp}@listing.example`, `loose-${stamp}@listing.example`]]);
    await q('DELETE FROM profiles WHERE user_id IN (?)', [Object.values(ids)]);
    await q('DELETE FROM users WHERE id IN (?)', [Object.values(ids)]);
    await app.close();
});

const get = (url) => app.request('GET', `/api/v1${url}`);
const labelOf = (row) => Object.keys(ids).find((label) => ids[label] === row.id);
// The labels of this file's rows, in the answer's order.
const labels = (rows) => rows.map(labelOf).filter(Boolean);
// Every row the list answers for this query, page by page (other tests leave pages of their own).
const list = async (query = '') => {
    const rows = [];
    for (let n = 1; ; n++) {
        const res = await get(`/profiles?limit=50&page=${n}&${query}`);
        assert.equal(res.status, 200, res.body.message);
        rows.push(...res.body.data.rows);
        if (res.body.data.rows.length < 50) return { count: res.body.data.count, rows };
    }
};
const ours = async (query) => labels((await list(query)).rows);
// How many pages the list finds for this query; a brand filter's counts by key.
const countOf = async (query) => (await get(`/profiles?limit=1&${query}`)).body.data.count;
const byKey = (options) => Object.fromEntries(options.map((option) => [option.key, option.count]));
const refusal = (res) => [res.status, res.body.code, res.body.details];

describe('U.S. states (Nov 3)', () => {
    test('a state\'s code from its code or its name in any case, its name from its code; null for anything else', () => {
        for (const text of ['NV', 'nv', 'Nevada', ' nevada ', 'NEVADA']) assert.equal(stateCode(text), 'NV', text);
        assert.deepEqual([stateCode('District of Columbia'), stateCode('pr'), stateCode('Ontario'), stateCode(''), stateCode(null), stateCode('constructor')],
            ['DC', 'PR', null, null, null, null]);
        assert.deepEqual([stateName('NV'), stateName(' nv '), stateName('Nevada'), stateName('XX'), stateName('constructor')], ['Nevada', 'Nevada', null, null, null]);
        assert.equal(Object.keys(STATES).length, 52, 'the 50 states, DC and Puerto Rico');
    });
});

describe('GET /profiles: the order (Nov 3)', () => {
    test('by name (the default), recommended, newest and nearest, each ending with the name, then the account', async () => {
        const byName = ['ava', 'bea', 'cy', 'dee', 'eve', 'fay', 'nia', 'noa', 'twin1', 'twin2'];
        assert.deepEqual(await ours('type=individual'), byName);
        assert.deepEqual(await ours('type=individual&sort=name'), byName);
        assert.deepEqual(await ours('type=individual&sort=recommended'), ['bea', 'ava', 'cy', 'dee', 'eve', 'fay', 'nia', 'noa', 'twin1', 'twin2'],
            'featured first in their order, then the rest by name (a featured_order left on an unfeatured page counts for nothing)');
        assert.deepEqual(await ours('type=individual&sort=newest'), ['twin1', 'twin2', 'bea', 'cy', 'eve', 'fay', 'ava', 'dee', 'nia', 'noa']);

        const near = (await list(`type=individual&sort=nearest&${HERE}`)).rows.filter(labelOf);
        assert.deepEqual(labels(near), ['ava', 'bea', 'cy', 'twin1', 'twin2', 'dee', 'nia', 'eve', 'fay', 'noa'], 'pages without a point last, by name');
        const miles = Object.fromEntries(near.map((row) => [labelOf(row), row.distance_miles]));
        assert.equal(miles.ava, 0);
        assert.ok(miles.bea > 1 && miles.bea < 3 && miles.cy > 30 && miles.cy < 40 && miles.dee > 250, JSON.stringify(miles));
        assert.equal(miles.twin1, miles.twin2);
        assert.deepEqual([miles.eve, miles.fay, miles.noa], [null, null, null]);
        for (const value of Object.values(miles)) if (value !== null) assert.equal(value, Math.round(value * 10) / 10, 'one decimal');
    });

    test('featured=true keeps its featured order unless a sort is asked for', async () => {
        assert.deepEqual(await ours('featured=true'), ['bea', 'ava']);
        assert.deepEqual(await ours('featured=true&sort=name'), ['ava', 'bea']);
    });

    test('nearest needs lat and lng, sent together; an unknown order is refused', async () => {
        for (const [query, field] of [
            ['sort=nearest', 'sort'], ['sort=popular', 'sort'], ['lat=44.4', 'lng'], ['lng=-73.2', 'lat'], ['lat=91&lng=0', 'lat'], ['lat=0&lng=abc', 'lng'],
        ]) {
            assert.deepEqual(refusal(await get(`/profiles?${query}`)), [400, 'INVALID_PROFILE_QUERY', { field }], query);
        }
        assert.equal((await get('/profiles?sort=nearest')).body.message, 'Sort by nearest needs lat and lng.');
    });
});

describe('GET /profiles: filters (Nov 3)', () => {
    test('a specialty: the page\'s category, its primary specialty or an entry of its list, trimmed, in any case', async () => {
        for (const value of [S('Esthetician'), S('esthetician'), ` ${S('ESTHETICIAN')} `]) {
            assert.deepEqual(await ours(`type=individual&specialty=${encodeURIComponent(value)}`), ['ava', 'bea', 'cy', 'eve'], value);
        }
        assert.deepEqual(await ours(`specialty=${encodeURIComponent(S('lash lift'))}`), ['ava'], 'an entry of the list');
        assert.deepEqual(await ours(`specialty=${encodeURIComponent(S('FACIALIST'))}`), ['bea'], 'a primary specialty');
        assert.deepEqual(await ours(`specialty=${encodeURIComponent(S('Brows'))}`), ['dee'], 'a listing\'s');
        assert.deepEqual(await ours(`specialty=${encodeURIComponent(`Esthetician ${stamp.slice(0, 4)}`)}`), [], 'the whole name, not a part');
        assert.deepEqual(refusal(await get(`/profiles?specialty=${'x'.repeat(101)}`)), [400, 'INVALID_PROFILE_QUERY', { field: 'specialty' }]);
    });

    test('a state by its code or its name, in any case (another place as typed), and a city', async () => {
        for (const state of ['VT', 'vt', 'Vermont', ' vermont ']) {
            assert.deepEqual(await ours(`type=individual&state=${encodeURIComponent(state)}`), ['ava', 'bea', 'cy', 'eve', 'twin1', 'twin2'], state);
        }
        for (const state of ['NV', 'Nevada', 'nevada']) assert.deepEqual(await ours(`type=individual&state=${state}`), ['nia', 'noa'], state);
        assert.deepEqual(await ours('state=ONTARIO'), ['dee']);
        assert.deepEqual(await ours('state=Atlantis'), []);
        assert.deepEqual(await ours('type=individual&city=Burlington'), ['ava', 'bea'], '"burlington " too');
        assert.deepEqual(await ours('type=individual&state=Vermont&city=rutland'), ['twin1', 'twin2']);
        assert.deepEqual(await ours('type=individual&state=NV&city=LAS%20VEGAS'), ['nia', 'noa']);
    });

    test('a brand\'s category and shipping, keys of their lists in any case; another value is refused', async () => {
        assert.deepEqual(await ours('type=brand&category=skincare'), ['glow']);
        assert.deepEqual(await ours('type=brand&category=Skincare'), ['glow']);
        assert.deepEqual(await ours('type=brand&shipping=local'), ['hue']);
        assert.deepEqual(await ours('type=brand&category=makeup&shipping=local'), ['hue']);
        assert.deepEqual(await ours('type=brand&category=fragrance'), []);
        assert.deepEqual(refusal(await get('/profiles?type=brand&category=serums')), [400, 'INVALID_PROFILE_QUERY', { field: 'category' }]);
        assert.deepEqual(refusal(await get('/profiles?type=brand&shipping=worldwide')), [400, 'INVALID_PROFILE_QUERY', { field: 'shipping' }]);
    });

    test('within a radius of the visitor: pages farther away, or without a point, drop out', async () => {
        assert.deepEqual(await ours(`type=individual&${HERE}&radius=50`), ['ava', 'bea', 'cy']);
        assert.deepEqual(await ours(`type=individual&${HERE}&radius=100`), ['ava', 'bea', 'cy', 'twin1', 'twin2']);
        assert.deepEqual(await ours(`type=individual&${HERE}&radius=500&sort=nearest`), ['ava', 'bea', 'cy', 'twin1', 'twin2', 'dee']);
        for (const query of [`${HERE}&radius=0`, `${HERE}&radius=501`, `${HERE}&radius=far`, 'radius=50']) {
            assert.deepEqual(refusal(await get(`/profiles?${query}`)), [400, 'INVALID_PROFILE_QUERY', { field: 'radius' }], query);
        }
    });

    test('rows add the page\'s category, its label and shipping; distance_miles only when asked from a point', async () => {
        const rows = (await list('type=individual')).rows;
        const bea = rows.find((row) => row.id === ids.bea);
        assert.deepEqual([bea.category, bea.category_label, bea.shipping], [S('esthetician'), S('esthetician'), null], 'a professional\'s, as typed');
        const ava = rows.find((row) => row.id === ids.ava);
        assert.deepEqual([ava.category, ava.category_label, ava.shipping], [null, null, null]);
        const glow = (await list('type=brand')).rows.find((row) => row.id === ids.glow);
        assert.deepEqual([glow.category, glow.category_label, glow.shipping], ['skincare', 'Skincare Brand', 'nationwide']);
        const keys = ['category', 'category_label', 'city', 'id', 'image', 'is_featured', 'name', 'shipping', 'slug', 'specialty', 'state', 'tagline', 'type'];
        assert.deepEqual(Object.keys(bea).toSorted(), keys);
        const near = (await list(`type=individual&${HERE}`)).rows.find((row) => row.id === ids.bea);
        assert.deepEqual(Object.keys(near).toSorted(), [...keys, 'distance_miles'].toSorted());
    });

    test('the site-wide search takes none of them', async () => {
        const res = await get(`/search?q=${stamp}&type=professionals&limit=50&sort=nearest&specialty=none&state=Atlantis&radius=-1`);
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual(labels(res.body.data.rows).toSorted(), ['ava', 'bea', 'cy', 'dee', 'eve', 'fay', 'nia', 'noa', 'twin1', 'twin2']);
    });
});

describe('GET /directory/filters (Nov 3)', () => {
    test('professionals: specialties as the list compares them, by their most used spelling; states with their cities', async () => {
        const res = await get('/directory/filters');
        assert.equal(res.status, 200, res.body.message);
        const filters = res.body.data;
        assert.deepEqual(Object.keys(filters), ['type', 'count', 'specialties', 'states']);
        assert.equal(filters.type, 'individual');
        assert.equal(filters.count, await countOf('type=individual'));
        // "Makeup" and "makeup" are used once each: the first by name (capitals first) names them.
        assert.deepEqual(filters.specialties.filter((s) => s.name.includes(stamp)), [
            { name: S('Esthetician'), count: 4 }, { name: S('Hair'), count: 4 }, { name: S('Makeup'), count: 2 },
            { name: S('Brows'), count: 1 }, { name: S('Facialist'), count: 1 }, { name: S('Lash Lift'), count: 1 }, { name: S('Nails'), count: 1 },
        ]);
        assert.ok(filters.specialties.every((s) => s.name.trim() && s.name.length <= 100), 'no empty names, none longer than the filter takes');
        // Eve counts in Vermont without a city; "burlington " is Burlington.
        assert.deepEqual(filters.states.find((s) => s.code === 'VT'), {
            code: 'VT', name: 'Vermont', count: 6, cities: [{ name: 'Burlington', count: 2 }, { name: 'Rutland', count: 2 }, { name: 'Montpelier', count: 1 }],
        });
        assert.deepEqual(filters.states.find((s) => s.name === 'Ontario'), { code: null, name: 'Ontario', count: 1, cities: [{ name: 'Toronto', count: 1 }] });
        assert.ok(filters.states.find((s) => s.code === 'NV').count >= 2);
        for (const options of [filters.specialties, filters.states, ...filters.states.map((s) => s.cities)]) {
            options.forEach((option, i) => assert.ok(i === 0 || options[i - 1].count >= option.count, `${option.name}: by count`));
        }
    });

    test('brands: every category and shipping option, in list order, zeros included', async () => {
        const filters = (await get('/directory/filters?type=brand')).body.data;
        assert.deepEqual(Object.keys(filters), ['type', 'count', 'categories', 'shipping']);
        assert.equal(filters.count, await countOf('type=brand'));
        assert.deepEqual(filters.categories.map((c) => [c.key, c.label]), [
            ['skincare', 'Skincare'], ['haircare', 'Haircare'], ['makeup', 'Makeup'], ['nails', 'Nails'], ['body', 'Body & Bath'],
            ['fragrance', 'Fragrance'], ['wellness', 'Wellness & Supplements'], ['devices', 'Devices & Tools'],
        ]);
        assert.deepEqual(filters.shipping.map((s) => [s.key, s.label]), [['local', 'Local pickup or delivery'], ['nationwide', 'Ships nationwide'], ['international', 'Ships internationally']]);
        const { skincare, makeup, fragrance } = byKey(filters.categories);
        assert.ok(skincare >= 1 && makeup >= 1 && byKey(filters.shipping).local >= 1);
        assert.equal(fragrance, 0);
    });

    test('each option counts what GET /profiles finds for it', async () => {
        const people = (await get('/directory/filters?type=individual')).body.data;
        for (const { name, count } of people.specialties) assert.equal(await countOf(`type=individual&specialty=${encodeURIComponent(name)}`), count, name);
        for (const state of people.states) {
            for (const spelling of [state.code, state.name].filter(Boolean)) {
                assert.equal(await countOf(`type=individual&state=${encodeURIComponent(spelling)}`), state.count, spelling);
            }
            for (const city of state.cities) {
                const query = `type=individual&state=${encodeURIComponent(state.code ?? state.name)}&city=${encodeURIComponent(city.name)}`;
                assert.equal(await countOf(query), city.count, `${city.name}, ${state.name}`);
            }
        }
        const brands = (await get('/directory/filters?type=brand')).body.data;
        for (const { key, count } of brands.categories) assert.equal(await countOf(`type=brand&category=${key}`), count, key);
        for (const { key, count } of brands.shipping) assert.equal(await countOf(`type=brand&shipping=${key}`), count, key);
    });

    test('another type is refused', async () => {
        assert.deepEqual(refusal(await get('/directory/filters?type=salon')), [400, 'INVALID_DIRECTORY_QUERY', { field: 'type' }]);
    });
});

describe('GET /directory/map (Nov 3)', () => {
    test('the professionals\' pages in a box, featured first in their order, then by name and id; points to 3 decimals', async () => {
        const res = await get(`/directory/map?${VERMONT}`);
        assert.equal(res.status, 200, res.body.message);
        const { count, rows } = res.body.data;
        assert.equal(count, 5);
        assert.deepEqual(labels(rows), ['bea', 'ava', 'cy', 'twin1', 'twin2']);
        assert.deepEqual(rows[0], {
            id: ids.bea, slug: `bea${stamp}`, name: S('Bea'), image: null, specialty: S('esthetician'),
            city: 'burlington ', state: 'VT', latitude: 44.491, longitude: -73.182,
        });
        assert.deepEqual([rows[1].specialty, rows[1].state, rows[1].latitude, rows[1].longitude], [S('Esthetician'), 'VT', 44.476, -73.212],
            'no category: the primary specialty');
        assert.equal(rows[2].state, 'VT', '"vt" by its code');
        const toronto = (await get('/directory/map?north=44&south=43&east=-79&west=-80')).body.data;
        assert.deepEqual(toronto.rows.map((r) => [r.name, r.slug, r.state, r.specialty]), [[S('Dee'), `dee-${stamp}`, 'Ontario', S('Brows')]], 'another place as stored');
    });

    test('only pages: no listing without an account, no brand, hidden page or page without a point', async () => {
        const nearby = (await get(`/directory/search?${HERE}&radius=1&limit=50`)).body.data.rows;
        assert.ok(nearby.some((row) => row.kind === 'listing' && row.name === S('Loose Listing')), 'the directory search has the listing');
        const pins = (await get(`/directory/map?${VERMONT}`)).body.data.rows;
        for (const name of ['Loose Listing', 'Glow', 'Hidden', 'Eve']) assert.ok(!pins.some((pin) => pin.name === S(name)), name);
    });

    test('a box needs all four sides, in range, south below north and west below east', async () => {
        for (const [query, field] of [
            ['north=45', 'south'], ['north=45&south=44&east=-72', 'west'], ['north=91&south=0&east=1&west=0', 'north'],
            ['north=45&south=44&east=abc&west=-73', 'east'], ['north=45&south=46&east=-72&west=-73', 'south'], ['north=45&south=44&east=-73&west=-72', 'west'],
        ]) {
            assert.deepEqual(refusal(await get(`/directory/map?${query}`)), [400, 'INVALID_DIRECTORY_QUERY', { field }], query);
        }
    });

    describe('the limit', () => {
        const pins = [];
        // 205 professionals around Casper, Wyoming, removed afterwards.
        const CASPER = 'north=43.1&south=42.7&east=-106.1&west=-106.5';
        before(async () => {
            const emails = Array.from({ length: 205 }, (_, i) => `pin-${i + 1}-${stamp}@pins.example`);
            await q(`INSERT INTO users (email, role_id, account_type, professional_type, status, is_active) VALUES
                ${emails.map(() => "(?, 7, 'professional', 'individual', 'ACCEPTED', 1)").join(', ')}`, emails);
            const users = await q('SELECT id FROM users WHERE email LIKE ? ORDER BY id', [`pin-%-${stamp}@pins.example`]);
            pins.push(...users.map((user) => user.id));
            await q(`INSERT INTO business_cards (user_id, name, status, slug) VALUES ${pins.map(() => "(?, ?, 'accepted', ?)").join(', ')}`,
                pins.flatMap((id, i) => [id, `Pin ${i + 1} ${stamp}`, `pin${i + 1}x${stamp}`]));
            const cards = await q('SELECT id FROM business_cards WHERE user_id IN (?) ORDER BY id', [pins]);
            await q(`INSERT INTO business_locations (business_card_id, location_type, city, state, latitude, longitude, is_primary) VALUES
                ${cards.map(() => "(?, 'city_only', 'Casper', 'WY', ?, ?, 1)").join(', ')}`,
                cards.flatMap((card, i) => [card.id, 42.8 + (i % 20) / 100, -106.4 + Math.floor(i / 20) / 100]));
        });
        after(async () => {
            if (pins.length) await q('DELETE FROM users WHERE id IN (?)', [pins]);
        });

        test('100 by default, at most 200; count is every pin', async () => {
            const rows = async (query) => {
                const res = await get(`/directory/map?${CASPER}&${query}`);
                assert.equal(res.status, 200, res.body.message);
                assert.equal(res.body.data.count, 205);
                return res.body.data.rows.length;
            };
            assert.deepEqual([await rows(''), await rows('limit=2'), await rows('limit=150'), await rows('limit=1000'), await rows('limit=abc')], [100, 2, 150, 200, 100]);
            const all = (await get('/directory/map')).body.data;
            assert.ok(all.count >= 205 + 7 && all.rows.length === 100, 'without a box, every pin is counted');
        });
    });
});
