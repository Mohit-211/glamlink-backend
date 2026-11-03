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
        assert.deepEqual(Object.keys(data.rows[0]).toSorted(), [
            'category', 'category_label', 'city', 'id', 'image', 'is_featured', 'name', 'shipping', 'slug', 'specialty', 'state', 'tagline', 'type',
        ]);
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

// The page in the owner's design (Mohit, Nov 3): one layout for brands and professionals, with an intro, a category and
// shipping, an About image, Quick Info lines, and the first rows of its media, education, podcast and products.
describe('the page in the owner\'s design (Nov 3)', () => {
    const lumi = {};
    const LONG_BIO = `<p>Lumi &amp; Co. makes <strong>barrier-first</strong> skincare.</p><p>${'Science-led formulas for sensitive skin. '.repeat(9)}</p>`;

    before(async () => {
        lumi.id = await insert(
            "INSERT INTO users (email, role_id, account_type, professional_type, status, is_active, email_verified_at, password) VALUES (?, 8, 'professional', 'brand', 'ACCEPTED', 1, NOW(), 'x')",
            [`lumi-${stamp}@account.example`],
        );
        await insert('INSERT INTO profiles (user_id, email, name) VALUES (?, ?, ?)', [lumi.id, `lumi-${stamp}@account.example`, 'Lumi Person']);
        lumi.slug = `lumi${stamp}`;
        lumi.card = await insert(
            "INSERT INTO business_cards (user_id, name, business_name, bio, status, slug, business_card_link) VALUES (?, 'Lumi Person', 'Lumi', ?, 'accepted', ?, ?)",
            [lumi.id, LONG_BIO, lumi.slug, `https://glamlink.net/access/${lumi.slug}`],
        );
        const gallery = (uri, type, order, cover) => insert(
            'INSERT INTO business_gallery_media (business_card_id, file_type, file_uri, sort_order, is_thumbnail) VALUES (?, ?, ?, ?, ?)',
            [lumi.card, type, `${config.API_BASE_URL}/${type === 'video' ? 'videos' : 'images'}/${uri}`, order, cover ? 1 : 0],
        );
        await gallery(`lumi-clip-${stamp}.mp4`, 'video', 1, true);
        await gallery(`lumi-photo-${stamp}.png`, 'image', 2, false);
        await gallery(`lumi-cover-${stamp}.png`, 'image', 3, true);
        lumi.cover = `${config.API_BASE_URL}/images/lumi-cover-${stamp}.png`;
    });
    // The Watch tests list whole series: the episodes made here go.
    after(async () => {
        if (lumi.videos) await q('DELETE FROM videos WHERE id IN (?)', [lumi.videos]);
    });

    test('until they are set: the intro is the card bio as text (300 characters at most), the cover and About image the card\'s cover photo', async () => {
        const p = (await page(lumi.slug)).body.data;
        assert.ok(p.intro.length <= 300 && p.intro.length > 250, p.intro);
        assert.ok(p.intro.startsWith('Lumi & Co. makes barrier-first skincare. Science-led formulas'), p.intro);
        assert.match(p.intro, /[a-z.] ?…$/, 'cut at a word');
        assert.ok(!p.intro.includes('<') && !p.intro.includes('&amp;'));
        assert.deepEqual([p.category, p.category_label, p.shipping, p.shipping_label], [null, null, null, null]);
        assert.deepEqual([p.cover_image, p.about_image], [lumi.cover, lumi.cover], 'the photo marked as the cover, not the video');
        assert.deepEqual(p.quick_info, { has_education: false, on_podcast: false, in_journal: false });
        assert.deepEqual([p.media.count, p.education, p.podcast], [3, { count: 0, rows: [] }, { count: 0, rows: [] }]);

        const kate = (await page(`kate-${stamp}`)).body.data;
        assert.equal(kate.intro, 'Bridal makeup in Vegas');
        assert.deepEqual([kate.about_image, kate.media], [null, { count: 0, rows: [] }], 'a card without a gallery');
    });

    test('an owner sets the intro, a category, shipping and the About image (a file or a link); "" clears each', async () => {
        const mine = await app.request('GET', '/api/v1/my/profile', { token: tokens.kate });
        for (const key of ['intro', 'category', 'shipping', 'about_image']) assert.equal(mine.body.data.page[key], null, key);

        const res = await app.form('PUT', '/api/v1/my/profile', {
            fields: { intro: 'Bridal glam for Las Vegas weddings.', category: 'Bridal Makeup', shipping: 'local' },
            files: { about_image: [photo('about.png')] },
            token: tokens.kate,
        });
        assert.equal(res.status, 200, res.body.message);
        const set = res.body.data.page;
        assert.deepEqual([set.intro, set.category, set.shipping], ['Bridal glam for Las Vegas weddings.', 'Bridal Makeup', 'local']);
        assert.match(set.about_image, /\/images\/about_image-/);
        const shown = (await page(`kate-${stamp}`)).body.data;
        assert.deepEqual([shown.intro, shown.category, shown.category_label, shown.shipping, shown.shipping_label, shown.about_image], [
            'Bridal glam for Las Vegas weddings.', 'Bridal Makeup', 'Bridal Makeup', 'local', 'Local pickup or delivery', set.about_image,
        ]);

        const link = await app.request('PUT', '/api/v1/my/profile', { body: { about_image: set.about_image, shipping: 'international' }, token: tokens.kate });
        assert.deepEqual([link.body.data.page.about_image, link.body.data.public.shipping_label], [set.about_image, 'Ships internationally']);
        const cleared = await app.form('PUT', '/api/v1/my/profile', { fields: { intro: '', category: '', shipping: '', about_image: '' }, token: tokens.kate });
        assert.equal(cleared.status, 200, cleared.body.message);
        assert.deepEqual(['intro', 'category', 'shipping', 'about_image'].map((key) => cleared.body.data.page[key]), [null, null, null, null]);
        assert.deepEqual([cleared.body.data.public.intro, cleared.body.data.public.category_label], ['Bridal makeup in Vegas', null]);
    });

    test('a brand\'s category is a key from the list, shown as "<label> Brand"; a professional\'s any text up to 60; shipping one of three', async () => {
        const brand = await app.request('PUT', `/api/v1/profiles/admin/${ids.revance}`, { body: { category: 'Skincare' }, headers: auth });
        assert.equal(brand.status, 200, brand.body.message);
        assert.deepEqual([brand.body.data.page.category, brand.body.data.public.category_label], ['skincare', 'Skincare Brand']);
        const refusals = [
            await app.request('PUT', `/api/v1/profiles/admin/${ids.revance}`, { body: { category: 'Serums' }, headers: auth }),
            await app.request('PUT', '/api/v1/my/profile', { body: { category: 'x'.repeat(61) }, token: tokens.kate }),
            await app.request('PUT', '/api/v1/my/profile', { body: { shipping: 'worldwide' }, token: tokens.kate }),
            await app.request('PUT', '/api/v1/my/profile', { body: { intro: 'x'.repeat(301) }, token: tokens.kate }),
            await app.request('PUT', '/api/v1/my/profile', { body: { about_image: 'https://elsewhere.example/a.png' }, token: tokens.kate }),
            await app.form('PUT', '/api/v1/my/profile', { files: { about_image: [{ name: 'a.pdf', type: 'application/pdf', data: Buffer.from('%PDF') }] }, token: tokens.kate }),
            await app.request('POST', '/api/v1/profiles/admin/brands', { body: { name: `Bad Category ${stamp}`, email: `badcat-${stamp}@brand.example`, category: 'Bridal' }, headers: auth }),
        ];
        assert.deepEqual(refusals.map((res) => [res.status, res.body.details?.field]), [
            [400, 'category'], [400, 'category'], [400, 'shipping'], [400, 'intro'], [400, 'about_image'], [400, 'about_image'], [400, 'category'],
        ]);
        assert.equal((await page(slugs.revance)).body.data.category_label, 'Skincare Brand', 'unchanged by the refusal');
        assert.equal((await app.request('PUT', '/api/v1/my/profile', { body: { category: 'Lashes & Brows' }, token: tokens.kate })).body.data.public.category_label, 'Lashes & Brows');

        const admin = await app.form('PUT', `/api/v1/profiles/admin/${ids.revance}`, { fields: { shipping: 'nationwide' }, files: { about_image: [photo('revance.png')] }, headers: auth });
        assert.equal(admin.status, 200, admin.body.message);
        assert.match(admin.body.data.page.about_image, /\/images\/about_image-/, 'admins send the file as the owner does');
        assert.equal(admin.body.data.public.shipping_label, 'Ships nationwide');
    });

    test('Quick Info and the first rows: 8 products, the newest Beauty Vault episode, 3 education items, 5 media; the About image is the first photo', async () => {
        for (let n = 1; n <= 9; n++) await insert("INSERT INTO shops (title, status, owner_id) VALUES (?, 'published', ?)", [`Lumi product ${n} ${stamp}`, lumi.id]);
        const [{ id: podcast }] = await q("SELECT id FROM video_series WHERE slug = 'beauty-vault-podcast'");
        const [{ id: expert }] = await q("SELECT id FROM video_series WHERE slug = 'expert-take'");
        const episode = (n, series, date) => insert(
            "INSERT INTO videos (youtube_id, title, slug, status, series_id, published_at) VALUES (?, ?, ?, 'published', ?, ?)",
            [`l${stamp}${n}`.slice(0, 11), `Lumi episode ${n}`, `lumi-episode-${n}-${stamp}`, series, date],
        );
        lumi.videos = [await episode(1, podcast, '2026-09-01'), await episode(2, podcast, '2026-10-01'), await episode(3, expert, '2026-10-15')];
        for (const video of lumi.videos) await insert("INSERT INTO video_people (video_id, user_id, role) VALUES (?, ?, 'guest')", [video, lumi.id]);
        const author = await insert("INSERT INTO authors (name) VALUES ('Lumi Writer')");
        const article = await insert("INSERT INTO journals (title, author_id, content, status) VALUES (?, ?, '<p>x</p>', 'published')", [`Inside Lumi ${stamp}`, author]);
        await insert("INSERT INTO journal_mentions (journal_id, source, user_id) VALUES (?, 'editor', ?)", [article, lumi.id]);
        for (let n = 1; n <= 5; n++) {
            await insert(
                "INSERT INTO profile_education (user_id, kind, slug, title, body, status, published_at, sort_order) VALUES (?, 'article', ?, ?, '<p>x</p>', ?, NOW(), ?)",
                [lumi.id, `lesson-${n}`, `Lesson ${n}`, n === 1 ? 'draft' : 'published', n],
            );
        }
        for (let n = 1; n <= 6; n++) {
            await insert("INSERT INTO profile_media (user_id, kind, source, url, sort_order) VALUES (?, 'image', 'upload', ?, ?)", [lumi.id, `${config.API_BASE_URL}/images/lumi-own-${n}-${stamp}.png`, n]);
        }

        const p = (await page(lumi.slug)).body.data;
        assert.deepEqual([p.products.count, p.products.rows.length], [9, 8]);
        assert.deepEqual([p.podcast.count, p.podcast.rows.map((r) => r.title)], [2, ['Lumi episode 2']]);
        assert.equal(p.podcast.rows[0].series.slug, 'beauty-vault-podcast');
        assert.deepEqual([p.videos.count, p.journal.count], [3, 1], 'the other lists as before');
        assert.deepEqual([p.education.count, p.education.rows.map((r) => r.slug)], [4, ['lesson-2', 'lesson-3', 'lesson-4']]);
        assert.deepEqual([p.media.count, p.media.rows.length, p.media.rows[0].source], [6, 5, 'upload']);
        assert.deepEqual(p.quick_info, { has_education: true, on_podcast: true, in_journal: true });
        assert.equal(p.about_image, `${config.API_BASE_URL}/images/lumi-own-1-${stamp}.png`);
        assert.equal(p.cover_image, lumi.cover);
    });

    const videos = async (query) => (await app.request('GET', `/api/v1/profiles/${lumi.slug}/videos?${query}`)).body.data;
    test('a page\'s videos by series: ?series=beauty-vault-podcast is its podcast episodes, newest first', async () => {
        assert.deepEqual((await videos('series=beauty-vault-podcast')).rows.map((r) => r.title), ['Lumi episode 2', 'Lumi episode 1']);
        assert.deepEqual((await videos('series=expert-take')).rows.map((r) => r.title), ['Lumi episode 3']);
        assert.deepEqual(await videos('series=no-such-series'), { count: 0, rows: [] });
        assert.equal((await videos('')).count, 3);
        assert.deepEqual((await videos('series=beauty-vault-podcast&limit=1&page=2')).rows.map((r) => r.title), ['Lumi episode 1']);
    });
});
