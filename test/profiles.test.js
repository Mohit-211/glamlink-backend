// Public profile pages (Phase 6; Mohit, Oct 23): every professional or brand with a live Access card has a page,
// shown while the card is live; admins unlist, feature and edit pages and make brand pages that show without a card;
// owners (Free too) edit their own page (website/profiles).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const { photo, cardFields, cardFiles } = require('./cardFixtures');
const config = require('../src/core/config/config');

let app, q, insert, auth;
const ids = {}; // accounts only
const other = {}; // cards, topics
const tokens = {};
const stamp = `${Date.now()}`.slice(-8);
const slugs = { kate: `katesue${stamp}`, revance: `revance${stamp}`, draft: `draftpro${stamp}`, hidden: `hiddenpro${stamp}` };

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    const { createSession } = require('../src/shared/identity');
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (6, 'User', 'USR'), (7, 'Professional', 'PRO'), (8, 'Brand', 'BRND')");

    const account = async (name, { type = 'individual', email = `${name.toLowerCase().replace(/\W/g, '')}-${stamp}@account.example` } = {}) => {
        const id = await insert(
            "INSERT INTO users (email, role_id, account_type, professional_type, status, is_active, email_verified_at, password) VALUES (?, ?, 'professional', ?, 'ACCEPTED', 1, NOW(), 'x')",
            [email, type === 'brand' ? 8 : 7, type],
        );
        await insert('INSERT INTO profiles (user_id, email, name, about) VALUES (?, ?, ?, ?)', [id, email, name, `${name} on the app`]);
        return id;
    };
    const card = async (userId, slug, fields = {}) => {
        const values = {
            name: 'Card Name', business_name: null, professional_title: null, bio: null, email: `${slug}@card.example`, phone: '7025550199',
            is_phone_visible: 1, specialties: null, social_media: null, primary_specialty: null, status: 'accepted', deleted_at: null, ...fields,
        };
        const id = await insert(
            `INSERT INTO business_cards (user_id, name, business_name, professional_title, bio, email, phone, is_phone_visible, specialties, social_media,
                primary_specialty, status, deleted_at, slug, business_card_link) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, values.name, values.business_name, values.professional_title, values.bio, values.email, values.phone, values.is_phone_visible,
                values.specialties, values.social_media, values.primary_specialty, values.status, values.deleted_at, slug, `https://glamlink.net/access/${slug}`],
        );
        return id;
    };

    ids.kate = await account('Kate Sue');
    other.kateCard = await card(ids.kate, slugs.kate, {
        name: 'Kate Sue', business_name: 'Kate Sue Beauty', professional_title: 'Makeup Artist', bio: '<p>Bridal makeup in Vegas</p>',
        is_phone_visible: 0, specialties: JSON.stringify(['Bridal', 'Editorial']), social_media: JSON.stringify({ instagram: '@katesue', tiktok: 'https://www.tiktok.com/@kate' }),
        primary_specialty: 'Bridal',
    });
    await insert("INSERT INTO business_locations (business_card_id, location_type, city, state, is_primary) VALUES (?, 'city_only', 'Las Vegas', 'NV', 1)", [other.kateCard]);
    ids.revance = await account('Rev Person', { type: 'brand' });
    await card(ids.revance, slugs.revance, { name: 'Rev Person', business_name: 'Revance', professional_title: 'Aesthetics brand' });
    ids.draft = await account('Draft Pro');
    await card(ids.draft, slugs.draft, { status: 'draft' });
    ids.gone = await account('Gone Pro');
    await card(ids.gone, `gonepro${stamp}`, { deleted_at: new Date() });
    ids.hidden = await account('Hidden Pro');
    await card(ids.hidden, slugs.hidden);
    await insert('INSERT INTO profile_pages (user_id, is_listed) VALUES (?, 0)', [ids.hidden]);

    const topic = await insert('INSERT INTO journal_topics (name, slug) VALUES (?, ?)', [`Brows ${stamp}`, `brows-${stamp}`]);
    await insert('INSERT INTO journal_topic_professional_mappings (topic_id, user_id, sort_order, is_active, created_at, updated_at) VALUES (?, ?, 1, 1, NOW(), NOW())', [topic, ids.kate]);
    other.topic = topic;

    tokens.kate = (await createSession({ id: ids.kate }, { client: 'test' })).tokens.access_token;
    tokens.draft = (await createSession({ id: ids.draft }, { client: 'test' })).tokens.access_token;
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Pages Admin', ?, 1, 1)", [`pages-admin-${stamp}@test.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
});
after(() => app.close());

const ours = (rows) => rows.filter((row) => Object.values(ids).includes(row.id));
// Every page the list answers for this query, page by page (other tests leave pages of their own).
const list = async (query = '') => {
    const rows = [];
    for (let n = 1; ; n++) {
        const res = await app.request('GET', `/api/v1/profiles?limit=50&page=${n}&${query}`);
        assert.equal(res.status, 200, res.body.message);
        rows.push(...res.body.data.rows);
        if (res.body.data.rows.length < 50) return { count: res.body.data.count, rows };
    }
};
const page = (slug) => app.request('GET', `/api/v1/profiles/${slug}`);

describe('GET /profiles', () => {
    test('lists the accounts with a live card, by name: a brand by its business name', async () => {
        const data = await list();
        assert.deepEqual(ours(data.rows).map((r) => [r.name, r.type, r.slug]), [['Kate Sue', 'individual', slugs.kate], ['Revance', 'brand', slugs.revance]]);
        assert.deepEqual(Object.keys(data.rows[0]).toSorted(), ['city', 'id', 'image', 'is_featured', 'name', 'slug', 'specialty', 'state', 'tagline', 'type']);
        const kate = ours(data.rows)[0];
        assert.deepEqual([kate.tagline, kate.city, kate.state, kate.specialty], ['Makeup Artist', 'Las Vegas', 'NV', 'Bridal']);
    });

    test('filters by type and searches name, tagline, specialties and place', async () => {
        assert.deepEqual(ours((await list('type=brand')).rows).map((r) => r.name), ['Revance']);
        assert.deepEqual(ours((await list('type=individual')).rows).map((r) => r.name), ['Kate Sue']);
        assert.deepEqual(ours((await list('search=vegas')).rows).map((r) => r.name), ['Kate Sue']);
        assert.deepEqual(ours((await list('search=editorial')).rows).map((r) => r.name), ['Kate Sue']);
        assert.deepEqual(ours((await list('search=aesthetics')).rows).map((r) => r.name), ['Revance']);
    });
});

describe('GET /profiles/:slug', () => {
    test('one page: the card\'s details, links and topics, no private fields', async () => {
        const res = await page(slugs.kate);
        assert.equal(res.status, 200, res.body.message);
        const p = res.body.data;
        assert.equal(p.id, ids.kate);
        assert.equal(p.name, 'Kate Sue');
        assert.equal(p.about, '<p>Bridal makeup in Vegas</p>');
        assert.deepEqual(p.specialties, ['Bridal', 'Editorial']);
        assert.deepEqual(p.social, [{ title: 'Instagram', url: 'https://www.instagram.com/katesue' }, { title: 'TikTok', url: 'https://www.tiktok.com/@kate' }]);
        assert.deepEqual(p.location, { city: 'Las Vegas', state: 'NV' });
        assert.equal(p.email, `${slugs.kate}@card.example`, 'the card\'s email, as the card shows it');
        assert.equal(p.phone, null, 'the owner hides the phone');
        assert.deepEqual(p.access_card, { slug: slugs.kate, url: `${config.WEBSITE_URL}/access/${slugs.kate}` });
        assert.deepEqual(p.topics, [{ id: other.topic, name: `Brows ${stamp}`, slug: `brows-${stamp}` }]);
        for (const section of ['products', 'journal', 'magazine', 'videos']) assert.deepEqual(p[section], { count: 0, rows: [] });
        const text = JSON.stringify(res.body);
        assert.ok(!text.includes('@account.example'), 'the account\'s own email is not shown');
    });

    test('a draft, a deleted card or an unlisted page shows nothing', async () => {
        for (const slug of [slugs.draft, `gonepro${stamp}`, slugs.hidden, 'nobody-here']) {
            const res = await page(slug);
            assert.equal(res.status, 404, slug);
            assert.equal(res.body.code, 'NOT_FOUND');
        }
        assert.deepEqual(ours((await list()).rows).map((r) => r.id).toSorted(), [ids.kate, ids.revance].toSorted());
    });
});

describe('admin', () => {
    test('features a page, gives it a slug of its own and a tagline; the card\'s handle still finds it', async () => {
        const res = await app.request('PUT', `/api/v1/profiles/admin/${ids.kate}`, {
            body: { is_featured: 'true', featured_order: '1', slug: `Kate ${stamp}`, tagline: 'Lashes & brows' }, headers: auth,
        });
        assert.equal(res.status, 200, res.body.message);
        assert.equal(res.body.data.slug, `kate-${stamp}`);
        assert.equal(res.body.data.visible, true);
        const featured = ours((await list('featured=true')).rows);
        assert.deepEqual(featured.map((r) => [r.name, r.tagline, r.is_featured]), [['Kate Sue', 'Lashes & brows', true]]);
        assert.equal((await page(`kate-${stamp}`)).body.data.id, ids.kate);
        assert.equal((await page(slugs.kate)).body.data.slug, `kate-${stamp}`);
    });

    test('a slug another page or card holds is refused', async () => {
        for (const slug of [`kate-${stamp}`, slugs.draft]) {
            const res = await app.request('PUT', `/api/v1/profiles/admin/${ids.revance}`, { body: { slug }, headers: auth });
            assert.equal(res.status, 400, slug);
            assert.deepEqual(res.body.details, { field: 'slug' });
        }
    });

    test('makes a brand page for a brand with no login; it shows without a card and the brand is invited to claim it', async () => {
        const email = `skinpen-${stamp}@brand.example`;
        const res = await app.request('POST', '/api/v1/profiles/admin/brands', { body: { name: `SkinPen ${stamp}`, email, tagline: 'Microneedling' }, headers: auth });
        assert.equal(res.status, 201, res.body.message);
        ids.skinpen = res.body.data.user_id;
        assert.equal(res.body.data.slug, `skinpen-${stamp}`);
        assert.equal(res.body.data.visible, true);
        const shown = (await page(`skinpen-${stamp}`)).body.data;
        assert.deepEqual([shown.type, shown.name, shown.tagline, shown.access_card, shown.email], ['brand', `SkinPen ${stamp}`, 'Microneedling', null, null]);
        assert.ok(ours((await list('type=brand')).rows).some((r) => r.id === ids.skinpen));

        const again = await app.request('POST', '/api/v1/profiles/admin/brands', { body: { name: 'Other', email }, headers: auth });
        assert.equal(again.status, 409);
        assert.equal(again.body.code, 'ACCOUNT_EXISTS');

        const sent = app.outbox.length;
        const invite = await app.request('POST', `/api/v1/profiles/admin/${ids.skinpen}/invite`, { headers: auth });
        assert.equal(invite.status, 200, invite.body.message);
        const mail = app.outbox.slice(sent).find((m) => m.to === email);
        assert.match(mail.text, /\/reset-password\?token=/);
        assert.equal((await app.request('POST', `/api/v1/profiles/admin/${ids.kate}/invite`, { headers: auth })).body.code, 'ALREADY_CLAIMED');
    });

    test('a new card never takes another account\'s page slug', async () => {
        const res = await app.form('POST', '/api/v1/businessCard', { fields: cardFields({ name: `SkinPen ${stamp}`, email: `twin-${stamp}@card.example` }), files: cardFiles() });
        assert.equal(res.status, 201, res.body.message);
        assert.equal(res.body.data.business_card_link.split('/access/')[1], `skinpen${stamp}`, 'card handles have no dashes; the page slug has');
        const [{ slug }] = await q('SELECT slug FROM business_cards WHERE id = ?', [res.body.data.business_card_id]);
        assert.notEqual(slug, `skinpen-${stamp}`);
    });

    test('the admin list shows every page and how it stands', async () => {
        const res = await app.request('GET', '/api/v1/profiles/admin/list?limit=50', { headers: auth });
        assert.equal(res.status, 200);
        const rows = ours(res.body.data.rows);
        const hidden = rows.find((r) => r.id === ids.hidden);
        assert.deepEqual([hidden.visible, hidden.is_listed, hidden.has_live_card], [false, false, true]);
        const skinpen = rows.find((r) => r.id === ids.skinpen);
        assert.deepEqual([skinpen.visible, skinpen.created_by_admin, skinpen.has_live_card, skinpen.claimed], [true, true, false, false]);
        assert.equal((await app.request('GET', '/api/v1/profiles/admin/list')).status, 401);
    });
});

describe('the owner\'s page', () => {
    test('an owner (Free too) edits the texts, links and images; rich text is cleaned; admin fields are not theirs', async () => {
        const res = await app.form('PUT', '/api/v1/my/profile', {
            fields: {
                tagline: 'Brides first', about: '<p>Hi <script>alert(1)</script><strong>there</strong></p>', website: 'kate.example',
                social: [{ title: 'Instagram', url: 'https://instagram.com/kate.sue' }], is_featured: 'false', slug: 'stolen',
            },
            files: { profile_image: [photo('logo.png')], images: [photo('cover.png')] },
            token: tokens.kate,
        });
        assert.equal(res.status, 200, res.body.message);
        const mine = res.body.data;
        assert.equal(mine.page.about, '<p>Hi <strong>there</strong></p>');
        assert.equal(mine.page.website, 'https://kate.example');
        assert.match(mine.page.image, /\/images\/profile_image-/);
        assert.match(mine.page.cover_image, /\/images\/images-/);
        assert.equal(mine.page.is_featured, true, 'featuring stays as the admin set it');
        assert.equal(mine.slug, `kate-${stamp}`);

        const shown = (await page(`kate-${stamp}`)).body.data;
        assert.deepEqual([shown.tagline, shown.website, shown.image, shown.cover_image], ['Brides first', 'https://kate.example', mine.page.image, mine.page.cover_image]);
        assert.deepEqual(shown.social, [{ title: 'Instagram', url: 'https://instagram.com/kate.sue' }]);

        const bad = await app.request('PUT', '/api/v1/my/profile', { body: { website: 'javascript:alert(1)' }, token: tokens.kate });
        assert.equal(bad.status, 400);
        assert.deepEqual(bad.body.details, { field: 'website' });
        const elsewhere = await app.request('PUT', '/api/v1/my/profile', { body: { image: 'https://elsewhere.example/a.png' }, token: tokens.kate });
        assert.deepEqual(elsewhere.body.details, { field: 'image' });
    });

    test('without a live card the owner sees why the page is hidden', async () => {
        const res = await app.request('GET', '/api/v1/my/profile', { token: tokens.draft });
        assert.equal(res.status, 200, res.body.message);
        assert.equal(res.body.data.visible, false);
        assert.equal(res.body.data.hidden_because, 'no_live_card');
        assert.equal((await app.request('GET', '/api/v1/my/profile')).status, 401);
    });
});
