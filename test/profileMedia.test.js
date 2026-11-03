// A page's Media & Images (Mohit, Nov 3): photos and videos (MP4 uploads, YouTube and Vimeo links) with no plan limit,
// in the owner's order; the live card's gallery shows until the page has items of its own, and the first add copies it
// in; admins edit and hide any page's (website/profiles/profileMedia.service.js). Vimeo's oEmbed is replaced by a fake.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const { PNG, photo, video } = require('./cardFixtures');
const config = require('../src/core/config/config');
const { UPLOADS_DIR } = require('../src/core/config/paths');
const { uploadedFilePath } = require('../src/core/http/uploadedFiles');
const { vimeo } = require('../src/integrations/vimeo');

let app, q, insert, auth;
const ids = {};
const tokens = {};
const card = {}; // the brand's card and its gallery items
const stamp = `${Date.now()}`.slice(-8);
const slugs = { brand: `glowmedia${stamp}`, fresh: `freshmedia${stamp}` };
const real = { ...vimeo };
const VIMEO_THUMB = 'https://i.vimeocdn.com/video/555_640.jpg';

// A file in the uploads folder, as the card form would have stored it; answers its link.
const stored = (folder, name, data = PNG) => {
    fs.mkdirSync(path.join(UPLOADS_DIR, folder), { recursive: true });
    fs.writeFileSync(path.join(UPLOADS_DIR, folder, name), data);
    return `${config.API_BASE_URL}/${folder}/${name}`;
};
const exists = (link) => fs.existsSync(uploadedFilePath(link));
// Files are deleted after the answer: wait for it (a second at most).
const removed = async (link) => {
    for (let waited = 0; waited < 1000 && exists(link); waited += 25) await new Promise((resolve) => setTimeout(resolve, 25));
    return !exists(link);
};

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    vimeo.thumbnail = async (url) => (url.includes('/76979871') ? VIMEO_THUMB : null);
    const { createSession } = require('../src/shared/identity');
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (6, 'User', 'USR'), (7, 'Professional', 'PRO'), (8, 'Brand', 'BRND')");

    const account = async (name, type) => {
        const email = `${name.toLowerCase()}-${stamp}@media.example`;
        const id = await insert(
            "INSERT INTO users (email, role_id, account_type, professional_type, status, is_active, email_verified_at, password) VALUES (?, ?, 'professional', ?, 'ACCEPTED', 1, NOW(), 'x')",
            [email, type === 'brand' ? 8 : 7, type],
        );
        await insert('INSERT INTO profiles (user_id, email, name) VALUES (?, ?, ?)', [id, email, name]);
        tokens[name.toLowerCase()] = (await createSession({ id }, { client: 'test' })).tokens.access_token;
        return id;
    };
    const liveCard = (userId, slug) => insert(
        "INSERT INTO business_cards (user_id, name, business_name, status, slug, business_card_link) VALUES (?, 'Card Name', ?, 'accepted', ?, ?)",
        [userId, `Business ${slug}`, slug, `https://glamlink.net/access/${slug}`],
    );
    const galleryItem = (cardId, fields) => insert(
        `INSERT INTO business_gallery_media (business_card_id, caption, file_type, file_uri, thumbnail_uri, sort_order, is_thumbnail, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [cardId, fields.caption ?? null, fields.type ?? 'image', fields.uri, fields.thumbnail ?? null, fields.order, fields.cover ? 1 : 0, fields.deleted ?? null],
    );

    ids.brand = await account('Glow', 'brand');
    card.id = await liveCard(ids.brand, slugs.brand);
    card.photoUrl = stored('images', `card-photo-${stamp}.png`);
    card.coverUrl = stored('images', `card-cover-${stamp}.png`);
    card.posterUrl = stored('images', `card-poster-${stamp}.png`);
    card.clipUrl = stored('videos', `card-clip-${stamp}.mp4`, Buffer.from('mp4'));
    card.photo = await galleryItem(card.id, { uri: card.photoUrl, order: 1, caption: 'Serum' });
    card.cover = await galleryItem(card.id, { uri: card.coverUrl, order: 2, cover: true });
    card.clip = await galleryItem(card.id, { uri: card.clipUrl, thumbnail: card.posterUrl, type: 'video', order: 3 });
    await galleryItem(card.id, { uri: stored('images', `card-gone-${stamp}.png`), order: 4, deleted: new Date() });

    ids.fresh = await account('Fresh', 'individual');
    const freshCard = await liveCard(ids.fresh, slugs.fresh);
    await galleryItem(freshCard, { uri: stored('images', `fresh-photo-${stamp}.png`), order: 1 });

    ids.other = await account('Other', 'individual');
    ids.user = await insert("INSERT INTO users (email, role_id, account_type, status, is_active) VALUES (?, 6, 'user', 'ACCEPTED', 1)", [`user-${stamp}@media.example`]);
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Media Admin', ?, 1, 1)", [`media-admin-${stamp}@test.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
});
after(async () => {
    Object.assign(vimeo, real);
    await app.close();
});

const publicMedia = async (slug, query = '') => (await app.request('GET', `/api/v1/profiles/${slug}/media?${query}`)).body.data;
const mine = async (token = tokens.glow) => (await app.request('GET', '/api/v1/my/profile/media?limit=100', { token })).body.data;
const addLink = (url, extra = {}, token = tokens.glow) => app.request('POST', '/api/v1/my/profile/media', { body: { url, ...extra }, token });

describe('until the page has media of its own', () => {
    test('it shows its live card\'s gallery: videos first, then the card\'s order, with the card items\' ids', async () => {
        const data = await publicMedia(slugs.brand);
        assert.equal(data.count, 3, 'a deleted card item never shows');
        assert.deepEqual(data.rows.map((r) => [r.id, r.kind, r.source]), [[card.clip, 'video', 'card'], [card.photo, 'image', 'card'], [card.cover, 'image', 'card']]);
        assert.deepEqual(data.rows[0], {
            id: card.clip, kind: 'video', source: 'card', url: card.clipUrl, thumbnail: card.posterUrl, embed_url: null, caption: null, alt: null, width: null, height: null,
        });
        assert.deepEqual([data.rows[1].caption, data.rows[1].thumbnail], ['Serum', null]);
        assert.deepEqual((await publicMedia(slugs.brand, 'kind=image')).rows.map((r) => r.id), [card.photo, card.cover]);
        assert.deepEqual((await publicMedia(slugs.brand, 'kind=video')).rows.map((r) => r.id), [card.clip]);
        assert.deepEqual((await publicMedia(slugs.brand, 'limit=1&page=2')).rows.map((r) => r.id), [card.photo]);
    });

    test('the page carries the first five, and its cover and About image fall back to the card\'s cover photo', async () => {
        const page = (await app.request('GET', `/api/v1/profiles/${slugs.brand}`)).body.data;
        assert.equal(page.media.count, 3);
        assert.deepEqual(page.media.rows.map((r) => r.source), ['card', 'card', 'card']);
        assert.equal(page.cover_image, card.coverUrl);
        assert.equal(page.about_image, card.coverUrl);
    });

    test('a page without a card has nothing to show', async () => {
        const res = await app.request('POST', '/api/v1/profiles/admin/brands', { body: { name: `No Card ${stamp}`, email: `nocard-${stamp}@media.example` }, headers: auth });
        assert.equal(res.status, 201, res.body.message);
        assert.deepEqual(await publicMedia(res.body.data.slug), { count: 0, rows: [] });

        const imported = await app.request('POST', `/api/v1/profiles/admin/${res.body.data.user_id}/media/import-card`, { headers: auth });
        assert.deepEqual([imported.status, imported.body.data], [200, { rows: [] }]);
        const [{ started }] = await q('SELECT media_started_at AS started FROM profile_pages WHERE user_id = ?', [res.body.data.user_id]);
        assert.equal(started, null, 'an import that copies nothing starts nothing');
    });
});

describe('the owner adds media', () => {
    test('the first add copies the card\'s gallery in first; the new items go first, in the order sent', async () => {
        const res = await app.form('POST', '/api/v1/my/profile/media', {
            fields: { captions: ['First', null, 'The clip'] },
            files: { images: [photo('one.png'), photo('two.png')], videos: [video('clip.mp4')], video_thumbnails: [photo('poster.png')] },
            token: tokens.glow,
        });
        assert.equal(res.status, 201, res.body.message);
        const added = res.body.data.rows;
        assert.deepEqual(added.map((r) => [r.kind, r.source, r.caption, r.from_card, r.is_hidden]), [
            ['image', 'upload', 'First', false, false], ['image', 'upload', null, false, false], ['video', 'upload', 'The clip', false, false],
        ]);
        assert.match(added[0].url, /\/images\/images-/);
        assert.deepEqual([added[0].width, added[0].height, added[0].thumbnail, added[0].embed_url], [1, 1, null, null]);
        assert.match(added[2].url, /\/videos\/videos-/);
        assert.match(added[2].thumbnail, /\/images\/video_thumbnails-/);
        ids.uploads = added.map((r) => r.id);
        Object.assign(card, { one: added[0], two: added[1], video: added[2] });

        const list = await mine();
        assert.equal(list.count, 6);
        assert.deepEqual(list.rows.slice(0, 3).map((r) => r.id), ids.uploads);
        assert.deepEqual(list.rows.slice(3).map((r) => [r.url, r.from_card, r.source]), [
            [card.clipUrl, true, 'upload'], [card.photoUrl, true, 'upload'], [card.coverUrl, true, 'upload'],
        ]);
        assert.deepEqual([list.rows[3].thumbnail, list.rows[4].caption, list.rows[4].width, list.rows[4].height], [card.posterUrl, 'Serum', 1, 1]);
        const [{ started }] = await q('SELECT media_started_at IS NOT NULL AS started FROM profile_pages WHERE user_id = ?', [ids.brand]);
        assert.equal(Number(started), 1);

        const shown = await publicMedia(slugs.brand);
        assert.equal(shown.count, 6);
        assert.ok(shown.rows.every((r) => r.source === 'upload'), 'the page\'s own items, the copies included');
        assert.ok(!('is_hidden' in shown.rows[0]), 'the public sees no owner fields');
        const page = (await app.request('GET', `/api/v1/profiles/${slugs.brand}`)).body.data;
        assert.deepEqual(page.media.rows.map((r) => r.id), list.rows.slice(0, 5).map((r) => r.id));
        assert.equal(page.about_image, card.one.url, 'the page\'s first photo');
        assert.equal(page.cover_image, card.coverUrl, 'the cover still falls back to the card\'s');
    });

    test('later adds do not copy the gallery again; import-card copies only what the page lacks, after the rest', async () => {
        const link = await addLink('https://youtu.be/dQw4w9WgXcQ', { caption: 'Watch' });
        assert.equal(link.status, 201, link.body.message);
        card.youtube = link.body.data.rows[0];
        assert.equal((await mine()).count, 7);
        assert.equal((await mine()).rows[0].id, card.youtube.id, 'first');

        const none = await app.request('POST', '/api/v1/my/profile/media/import-card', { token: tokens.glow });
        assert.equal(none.status, 200, none.body.message);
        assert.deepEqual(none.body.data.rows, []);

        const newer = await insert(
            "INSERT INTO business_gallery_media (business_card_id, file_type, file_uri, sort_order) VALUES (?, 'image', ?, 5)",
            [card.id, stored('images', `card-newer-${stamp}.png`)],
        );
        const some = await app.request('POST', '/api/v1/my/profile/media/import-card', { token: tokens.glow });
        assert.deepEqual(some.body.data.rows.map((r) => [r.from_card, r.url.endsWith(`card-newer-${stamp}.png`)]), [[true, true]]);
        const list = await mine();
        assert.equal(list.rows.at(-1).id, some.body.data.rows[0].id, 'last');
        const [{ copies }] = await q('SELECT COUNT(*) AS copies FROM profile_media WHERE user_id = ? AND card_media_id = ?', [ids.brand, newer]);
        assert.equal(Number(copies), 1);
    });
});

describe('links and uploads', () => {
    test('a YouTube or Vimeo link is a video: its id, watch link, player link and thumbnail', async () => {
        assert.deepEqual(card.youtube, {
            ...card.youtube,
            kind: 'video', source: 'youtube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', embed_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
            thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', caption: 'Watch', width: null, height: null,
        });
        const unlisted = (await addLink('https://vimeo.com/76979871/8272103f6e', { alt: 'A Vimeo video' })).body.data.rows[0];
        assert.deepEqual([unlisted.source, unlisted.url, unlisted.embed_url, unlisted.thumbnail, unlisted.alt], [
            'vimeo', 'https://vimeo.com/76979871/8272103f6e', 'https://player.vimeo.com/video/76979871?h=8272103f6e', VIMEO_THUMB, 'A Vimeo video',
        ]);
        const player = (await addLink('https://player.vimeo.com/video/11111111')).body.data.rows[0];
        assert.deepEqual([player.url, player.embed_url, player.thumbnail], ['https://vimeo.com/11111111', 'https://player.vimeo.com/video/11111111', null]);
        for (const id of [unlisted.id, player.id]) assert.equal((await app.request('DELETE', `/api/v1/my/profile/media/${id}`, { token: tokens.glow })).status, 200);
    });

    test('refused: other links, nothing to add, files that are not photos or MP4s, posters that do not match, stray files', async () => {
        const refusals = [
            [await addLink('https://example.com/clip.mp4'), 'url'],
            [await addLink('https://www.youtube.com/@glow'), 'url'],
            [await app.request('POST', '/api/v1/my/profile/media', { body: {}, token: tokens.glow }), 'images'],
            [await app.form('POST', '/api/v1/my/profile/media', { files: { images: [{ name: 'menu.pdf', type: 'application/pdf', data: Buffer.from('%PDF') }] }, token: tokens.glow }), 'images'],
            [await app.form('POST', '/api/v1/my/profile/media', { files: { videos: [{ name: 'clip.mov', type: 'video/quicktime', data: Buffer.from('mov') }] }, token: tokens.glow }), 'videos'],
            [await app.form('POST', '/api/v1/my/profile/media', { files: { videos: [video('a.mp4'), video('b.mp4')], video_thumbnails: [photo()] }, token: tokens.glow }), 'video_thumbnails'],
            [await app.form('POST', '/api/v1/my/profile/media', { fields: { captions: ['x'.repeat(256)] }, files: { images: [photo()] }, token: tokens.glow }), 'captions'],
            [await app.form('POST', '/api/v1/my/profile/media', { fields: { url: 'https://youtu.be/dQw4w9WgXcQ' }, files: { images: [photo()] }, token: tokens.glow }), 'url'],
            [await app.form('POST', '/api/v1/my/profile/media', { files: { images: [photo()], profile_image: [photo()] }, token: tokens.glow }), 'profile_image'],
        ];
        for (const [res, field] of refusals) assert.deepEqual([res.status, res.body.code, res.body.details?.field], [400, 'INVALID_PAGE', field], field);
        assert.equal((await mine()).count, 8, 'nothing was added');
        assert.equal((await app.request('POST', '/api/v1/my/profile/media', { body: { url: 'https://youtu.be/dQw4w9WgXcQ' } })).status, 401);
    });
});

describe('order and hidden items', () => {
    test('captions and alt texts; only admins hide an item, which leaves the page', async () => {
        const res = await app.request('PUT', `/api/v1/my/profile/media/${card.one.id}`, { body: { caption: 'Glass skin', alt: 'A serum bottle', is_hidden: true }, token: tokens.glow });
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual([res.body.data.caption, res.body.data.alt, res.body.data.is_hidden], ['Glass skin', 'A serum bottle', false]);
        assert.equal((await app.request('PUT', `/api/v1/my/profile/media/${card.one.id}`, { body: { alt: '' }, token: tokens.glow })).body.data.alt, null);
        assert.deepEqual((await app.request('PUT', `/api/v1/my/profile/media/${card.one.id}`, { body: { caption: 'x'.repeat(256) }, token: tokens.glow })).body.details, { field: 'caption' });

        const hidden = await app.request('PUT', `/api/v1/profiles/admin/${ids.brand}/media/${card.one.id}`, { body: { is_hidden: 'true' }, headers: auth });
        assert.equal(hidden.status, 200, hidden.body.message);
        assert.equal(hidden.body.data.is_hidden, true);
        assert.equal((await mine()).rows.find((r) => r.id === card.one.id).is_hidden, true, 'the owner still sees it');
        const shown = await publicMedia(slugs.brand);
        assert.ok(!shown.rows.some((r) => r.id === card.one.id));
        assert.equal(shown.count, 7);
        assert.equal((await app.request('GET', `/api/v1/profiles/${slugs.brand}`)).body.data.about_image, card.two.url, 'the first photo that shows');
    });

    test('the order is the whole list, hidden items too; anything else is refused', async () => {
        const all = (await mine()).rows.map((r) => r.id);
        const reversed = all.toReversed();
        const res = await app.request('PUT', '/api/v1/my/profile/media/order', { body: { ids: reversed }, token: tokens.glow });
        assert.deepEqual([res.status, res.body.data], [200, { ok: true }]);
        assert.deepEqual((await mine()).rows.map((r) => r.id), reversed);
        assert.deepEqual((await publicMedia(slugs.brand)).rows.map((r) => r.id), reversed.filter((id) => id !== card.one.id));

        const other = (await addLink('https://youtu.be/aaaaaaaaaaa', {}, tokens.other)).body.data.rows[0];
        for (const wrong of [all.slice(1), [...all, all[0]], [...all.slice(1), other.id], [...all.slice(1), 'x']]) {
            const refused = await app.request('PUT', '/api/v1/my/profile/media/order', { body: { ids: wrong }, token: tokens.glow });
            assert.deepEqual([refused.status, refused.body.details], [400, { field: 'ids' }]);
        }
        const asForm = await app.form('PUT', '/api/v1/my/profile/media/order', { fields: { ids: all }, token: tokens.glow });
        assert.equal(asForm.status, 200, asForm.body.message);
        assert.deepEqual((await mine()).rows.map((r) => r.id), all);
    });

    test('when every item of the page is hidden, the card\'s gallery shows again', async () => {
        await q('UPDATE profile_media SET is_hidden = 1 WHERE user_id = ?', [ids.brand]);
        const data = await publicMedia(slugs.brand);
        assert.deepEqual(data.rows.map((r) => r.source), ['card', 'card', 'card', 'card']);
        await q('UPDATE profile_media SET is_hidden = 0 WHERE user_id = ? AND id <> ?', [ids.brand, card.one.id]);
        assert.ok((await publicMedia(slugs.brand)).rows.every((r) => r.source !== 'card'), 'its own again once one shows');
    });
});

describe('deleting', () => {
    test('an item\'s own files go with it; a card file never; a file the page still shows stays', async () => {
        const del = (id, token = tokens.glow) => app.request('DELETE', `/api/v1/my/profile/media/${id}`, { token });

        const res = await del(card.two.id);
        assert.deepEqual([res.status, res.body.data], [200, { deleted: true }]);
        assert.ok(await removed(card.two.url), 'its upload is deleted');

        assert.equal((await del(card.video.id)).status, 200);
        assert.ok(await removed(card.video.url));
        assert.ok(await removed(card.video.thumbnail), 'and its poster');

        const copy = (await mine()).rows.find((r) => r.url === card.coverUrl);
        assert.equal((await del(copy.id)).status, 200);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.ok(exists(card.coverUrl), 'the card\'s file stays');

        const about = await app.request('PUT', '/api/v1/my/profile', { body: { about_image: card.one.url }, token: tokens.glow });
        assert.equal(about.status, 200, about.body.message);
        assert.equal((await del(card.one.id)).status, 200);
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.ok(exists(card.one.url), 'still the page\'s About image');

        assert.equal((await del(card.youtube.id)).status, 200);
        assert.deepEqual([(await del(card.youtube.id)).status, (await del(ids.uploads[0], tokens.other)).body.code], [404, 'NOT_FOUND']);
    });
});

describe('admins', () => {
    test('an admin manages any page\'s media as its owner does; the first add copies the card\'s gallery too', async () => {
        const base = `/api/v1/profiles/admin/${ids.fresh}/media`;
        const added = await app.request('POST', base, { body: { url: 'https://www.youtube.com/watch?v=bbbbbbbbbbb' }, headers: auth });
        assert.equal(added.status, 201, added.body.message);
        const list = (await app.request('GET', `${base}?limit=10`, { headers: auth })).body.data;
        assert.deepEqual(list.rows.map((r) => [r.source, r.from_card]), [['youtube', false], ['upload', true]]);
        const [{ byAdmin }] = await q('SELECT created_by_admin AS byAdmin FROM profile_media WHERE id = ?', [added.body.data.rows[0].id]);
        assert.equal(Number(byAdmin), 1);

        const uploaded = await app.form('POST', base, { files: { images: [photo('admin.png')] }, headers: auth });
        assert.equal(uploaded.status, 201, uploaded.body.message);
        const order = [list.rows[1].id, list.rows[0].id, uploaded.body.data.rows[0].id];
        assert.equal((await app.request('PUT', `${base}/order`, { body: { ids: order }, headers: auth })).status, 200);
        assert.deepEqual((await publicMedia(slugs.fresh)).rows.map((r) => r.id), order);
        assert.deepEqual((await app.request('POST', `${base}/import-card`, { headers: auth })).body.data, { rows: [] });
        assert.equal((await app.request('DELETE', `${base}/${uploaded.body.data.rows[0].id}`, { headers: auth })).status, 200);
        assert.ok(await removed(uploaded.body.data.rows[0].url));

        assert.equal((await app.request('GET', base)).status, 401);
        assert.equal((await app.request('GET', base, { token: tokens.fresh })).status, 401, 'an owner\'s token is not an admin\'s');
        assert.equal((await app.request('GET', `/api/v1/profiles/admin/${ids.user}/media`, { headers: auth })).status, 404, 'not a professional account');
        assert.equal((await app.request('DELETE', `${base}/${ids.uploads[0]}`, { headers: auth })).status, 404, 'another page\'s item');
    });
});
