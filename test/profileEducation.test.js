// A page's Education (Mohit, Nov 3): videos (MP4 uploads, YouTube and Vimeo links) and articles (cleaned HTML with
// links and images uploaded here, and a cover), each with its own page by a slug unique per page; published at once or
// kept as drafts, in the owner's order; admins edit any page's (website/profiles/profileEducation.service.js,
// articleHtml.js). Vimeo's oEmbed is replaced by a fake.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const { photo, video } = require('./cardFixtures');
const config = require('../src/core/config/config');
const { uploadedFilePath } = require('../src/core/http/uploadedFiles');
const { vimeo } = require('../src/integrations/vimeo');
const { sanitizeArticle } = require('../src/website/profiles/articleHtml');

let app, q, insert, auth;
const ids = {};
const tokens = {};
const items = {};
const stamp = `${Date.now()}`.slice(-8);
const slugs = { brand: `learnbrand${stamp}`, pro: `learnpro${stamp}` };
const real = { ...vimeo };
const API = config.API_BASE_URL;

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
    vimeo.thumbnail = async () => 'https://i.vimeocdn.com/video/777_640.jpg';
    const { createSession } = require('../src/shared/identity');
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (6, 'User', 'USR'), (7, 'Professional', 'PRO'), (8, 'Brand', 'BRND')");
    const account = async (key, name, type, slug) => {
        const email = `${key}-${stamp}@learn.example`;
        ids[key] = await insert(
            "INSERT INTO users (email, role_id, account_type, professional_type, status, is_active, email_verified_at, password) VALUES (?, ?, 'professional', ?, 'ACCEPTED', 1, NOW(), 'x')",
            [email, type === 'brand' ? 8 : 7, type],
        );
        await insert('INSERT INTO profiles (user_id, email, name) VALUES (?, ?, ?)', [ids[key], email, name]);
        await insert(
            "INSERT INTO business_cards (user_id, name, business_name, profile_image, status, slug, business_card_link) VALUES (?, ?, ?, ?, 'accepted', ?, ?)",
            [ids[key], name, `${name} Co`, `${API}/images/logo-${key}.png`, slug, `https://glamlink.net/access/${slug}`],
        );
        tokens[key] = (await createSession({ id: ids[key] }, { client: 'test' })).tokens.access_token;
    };
    await account('brand', 'Learn Brand', 'brand', slugs.brand);
    await account('pro', 'Learn Pro', 'individual', slugs.pro);
    ids.user = await insert("INSERT INTO users (email, role_id, account_type, status, is_active) VALUES (?, 6, 'user', 'ACCEPTED', 1)", [`user-${stamp}@learn.example`]);
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Learn Admin', ?, 1, 1)", [`learn-admin-${stamp}@test.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
});
after(async () => {
    Object.assign(vimeo, real);
    await app.close();
});

const add = (fields, files = {}, token = tokens.brand) => app.form('POST', '/api/v1/my/profile/education', { fields, files, token });
const edit = (id, fields, files = {}, token = tokens.brand) => app.form('PUT', `/api/v1/my/profile/education/${id}`, { fields, files, token });
const published = async (slug = slugs.brand, query = '') => (await app.request('GET', `/api/v1/profiles/${slug}/education?${query}`)).body.data;
const detail = (itemSlug, slug = slugs.brand) => app.request('GET', `/api/v1/profiles/${slug}/education/${itemSlug}`);
const mine = async (token = tokens.brand) => (await app.request('GET', '/api/v1/my/profile/education?limit=50', { token })).body.data;
const clean = sanitizeArticle;

describe('the article text', () => {
    test('keeps headings, paragraphs, emphasis, lists, quotes, web links and images uploaded here; nothing else', () => {
        assert.equal(clean('<h1>Big</h1><h2>Two</h2><h4>Four</h4><p>Hi <b>b</b> <strong>s</strong> <i>i</i> <em>e</em> <u>u</u></p>'),
            '<h2>Big</h2><h2>Two</h2><h3>Four</h3><p>Hi <strong>b</strong> <strong>s</strong> <em>i</em> <em>e</em> u</p>');
        assert.equal(clean('<ul><li>One</li></ul><ol><li>Two</li></ol><blockquote>Quote</blockquote><p>a<br>b</p>'),
            '<ul><li>One</li></ul><ol><li>Two</li></ol><blockquote>Quote</blockquote><p>a<br />b</p>');
        assert.equal(clean('<a href="https://site.example/x" target="_blank" rel="nofollow" title="t">site</a> <a href="http://a.example" target="_top">a</a>'),
            '<a href="https://site.example/x" target="_blank" rel="noopener noreferrer">site</a> <a href="http://a.example" rel="noopener noreferrer">a</a>');
        assert.equal(clean('<a href="javascript:alert(1)">x</a><a href="mailto:a@b.example">m</a>'), '<a rel="noopener noreferrer">x</a><a rel="noopener noreferrer">m</a>');
        assert.equal(clean(`<p><img src="${API}/images/a.png" alt="A" onerror="alert(1)" width="9"></p>`), `<p><img src="${API}/images/a.png" alt="A" /></p>`);
        for (const elsewhere of ['https://evil.example/a.png', 'data:image/png;base64,AAAA', `${API}/videos/a.mp4`, `${API}/images/../secret.png`, '//evil.example/a.png']) {
            assert.equal(clean(`<p>x<img src="${elsewhere}"></p>`), '<p>x</p>', elsewhere);
        }
        assert.equal(clean('<p style="color:red" onclick="x()" class="c">p</p><script>alert(1)</script><style>p{}</style><iframe src="https://www.youtube.com/embed/x"></iframe><div>d</div>'), '<p>p</p>d');
    });
});

describe('articles', () => {
    test('an owner writes an article: its text cleaned, a slug from its title, a cover; published at once', async () => {
        const res = await add(
            { kind: 'article', title: 'How to Layer Serums', summary: 'Thin to thick.', body: '<h2>Step one</h2><p>Cleanse<script>alert(1)</script></p><img src="https://evil.example/x.png">' },
            { images: [photo('cover.png')] },
        );
        assert.equal(res.status, 201, res.body.message);
        const a = res.body.data;
        assert.deepEqual([a.kind, a.slug, a.title, a.summary, a.status, a.video], ['article', 'how-to-layer-serums', 'How to Layer Serums', 'Thin to thick.', 'published', null]);
        assert.equal(a.body, '<h2>Step one</h2><p>Cleanse</p>');
        assert.match(a.cover_image, /\/images\/images-/);
        assert.ok(a.published_at && a.created_at && a.updated_at && Number.isInteger(a.sort_order));
        items.article = a;

        const list = await published();
        assert.deepEqual(list.rows.map((r) => r.slug), ['how-to-layer-serums']);
        assert.deepEqual(Object.keys(list.rows[0]).toSorted(), ['cover_image', 'id', 'kind', 'published_at', 'slug', 'summary', 'title', 'video']);
        const page = await detail('how-to-layer-serums');
        assert.equal(page.status, 200, page.body.message);
        assert.deepEqual(page.body.data, {
            ...list.rows[0], body: '<h2>Step one</h2><p>Cleanse</p>', page: { slug: slugs.brand, name: 'Learn Brand Co', type: 'brand', image: `${API}/images/logo-brand.png` },
        });
    });

    test('an image for the text is uploaded on its own, answered as { location }, and kept in the text', async () => {
        const res = await app.form('POST', '/api/v1/my/profile/uploads', { files: { images: [photo('inline.png')] }, token: tokens.brand });
        assert.equal(res.status, 201, res.body.message);
        const { location } = res.body.data;
        assert.ok(location.startsWith(`${API}/images/images-`));
        const saved = await edit(items.article.id, { body: `<p>Look:</p><p><img src="${location}" alt="Layers"></p>` });
        assert.equal(saved.body.data.body, `<p>Look:</p><p><img src="${location}" alt="Layers" /></p>`);
        assert.equal(saved.body.data.slug, 'how-to-layer-serums', 'the slug stays while the title does');

        for (const [files, field] of [[{}, 'images'], [{ images: [photo(), photo()] }, 'images'], [{ images: [{ name: 'a.pdf', type: 'application/pdf', data: Buffer.from('%PDF') }] }, 'images'], [{ videos: [video()] }, 'videos']]) {
            const refused = await app.form('POST', '/api/v1/my/profile/uploads', { files, token: tokens.brand });
            assert.deepEqual([refused.status, refused.body.details?.field], [400, field], field);
        }
        assert.equal((await app.form('POST', '/api/v1/my/profile/uploads', { files: { images: [photo()] } })).status, 401);
    });
});

describe('videos', () => {
    test('a YouTube link: its player link and thumbnail, which is the cover until one is set', async () => {
        const res = await app.request('POST', '/api/v1/my/profile/education', {
            body: { kind: 'video', title: 'Morning Routine', video_url: 'https://www.youtube.com/watch?v=abcdefghijk&t=30', duration_seconds: '95' }, token: tokens.brand,
        });
        assert.equal(res.status, 201, res.body.message);
        const v = res.body.data;
        assert.deepEqual(v.video, {
            source: 'youtube', url: 'https://www.youtube.com/watch?v=abcdefghijk', embed_url: 'https://www.youtube.com/embed/abcdefghijk',
            thumbnail: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg', duration_seconds: 95,
        });
        assert.equal(v.cover_image, v.video.thumbnail);
        items.youtube = v;
    });

    test('an uploaded MP4 with its poster; a Vimeo link', async () => {
        const res = await add({ kind: 'video', title: 'Peel Tutorial', status: 'published' }, { videos: [video('peel.mp4')], video_thumbnails: [photo('peel.png')] });
        assert.equal(res.status, 201, res.body.message);
        const v = res.body.data.video;
        assert.deepEqual([v.source, v.embed_url, v.duration_seconds], ['upload', null, null]);
        assert.match(v.url, /\/videos\/videos-/);
        assert.match(v.thumbnail, /\/images\/video_thumbnails-/);
        items.upload = res.body.data;

        const vimeoItem = (await add({ kind: 'video', title: 'Vimeo Class', video_url: 'vimeo.com/76979871/8272103f6e' })).body.data;
        assert.deepEqual(vimeoItem.video, {
            source: 'vimeo', url: 'https://vimeo.com/76979871/8272103f6e', embed_url: 'https://player.vimeo.com/video/76979871?h=8272103f6e',
            thumbnail: 'https://i.vimeocdn.com/video/777_640.jpg', duration_seconds: null,
        });
        items.vimeo = vimeoItem;
    });
});

describe('refusals', () => {
    test('400 with the field: kind, title, summary, status, the video, the cover, an article to publish without text', async () => {
        const cases = [
            [{ title: 'No kind' }, {}, 'kind'],
            [{ kind: 'podcast', title: 'Bad kind' }, {}, 'kind'],
            [{ kind: 'article', body: '<p>x</p>' }, {}, 'title'],
            [{ kind: 'article', title: 'x'.repeat(151), body: '<p>x</p>' }, {}, 'title'],
            [{ kind: 'article', title: 'Long summary', summary: 'x'.repeat(301), body: '<p>x</p>' }, {}, 'summary'],
            [{ kind: 'article', title: 'Bad status', status: 'live', body: '<p>x</p>' }, {}, 'status'],
            [{ kind: 'article', title: 'Empty' }, {}, 'body'],
            [{ kind: 'article', title: 'Only markup', body: '<p> </p><script>x</script>' }, {}, 'body'],
            [{ kind: 'article', title: 'Cover elsewhere', body: '<p>x</p>', cover_image: 'https://elsewhere.example/a.png' }, {}, 'cover_image'],
            [{ kind: 'video', title: 'No video' }, {}, 'video_url'],
            [{ kind: 'video', title: 'Not a video link', video_url: 'https://example.com/v.mp4' }, {}, 'video_url'],
            [{ kind: 'video', title: 'Both', video_url: 'https://youtu.be/abcdefghijk' }, { videos: [video()] }, 'video_url'],
            [{ kind: 'video', title: 'A mov' }, { videos: [{ name: 'a.mov', type: 'video/quicktime', data: Buffer.from('mov') }] }, 'videos'],
            [{ kind: 'video', title: 'Bad length', video_url: 'https://youtu.be/abcdefghijk', duration_seconds: 'long' }, {}, 'duration_seconds'],
            [{ kind: 'article', title: 'Stray file', body: '<p>x</p>' }, { profile_image: [photo()] }, 'profile_image'],
        ];
        for (const [fields, files, field] of cases) {
            const res = await add(fields, files);
            assert.deepEqual([res.status, res.body.code, res.body.details?.field], [400, 'INVALID_PAGE', field], fields.title ?? field);
        }
        assert.equal((await add({ kind: 'article', title: 'A draft to finish', status: 'draft' })).status, 201, 'a draft may be empty');
    });
});

describe('drafts, order and slugs', () => {
    test('drafts stay with the owner: not listed and no page; publishing dates them', async () => {
        const draft = (await mine()).rows.find((r) => r.title === 'A draft to finish');
        assert.deepEqual([draft.status, draft.published_at], ['draft', null]);
        assert.ok(!(await published()).rows.some((r) => r.id === draft.id));
        assert.equal((await detail(draft.slug)).status, 404);

        const res = await edit(draft.id, { status: 'published', body: '<p>Done now.</p>' });
        assert.equal(res.status, 200, res.body.message);
        assert.equal(res.body.data.status, 'published');
        assert.ok(res.body.data.published_at);
        assert.equal((await detail(draft.slug)).status, 200);
        const again = await edit(draft.id, { status: 'draft' });
        assert.equal((await detail(draft.slug)).status, 404);
        assert.equal(again.body.data.published_at, res.body.data.published_at, 'the first publishing\'s date stays');
        items.draft = again.body.data;
    });

    test('slugs are unique per page and change only with the title', async () => {
        const twin = (await add({ kind: 'article', title: 'How to Layer Serums!', body: '<p>Again</p>' })).body.data;
        assert.equal(twin.slug, 'how-to-layer-serums-2');
        const elsewhere = (await add({ kind: 'article', title: 'How to Layer Serums', body: '<p>Mine</p>' }, {}, tokens.pro)).body.data;
        assert.equal(elsewhere.slug, 'how-to-layer-serums', 'another page has its own slugs');

        assert.equal((await edit(twin.id, { summary: 'New summary' })).body.data.slug, 'how-to-layer-serums-2');
        const renamed = (await edit(twin.id, { title: 'Serum Order Explained' })).body.data;
        assert.equal(renamed.slug, 'serum-order-explained');
        assert.equal((await detail('how-to-layer-serums-2')).status, 404);
        assert.equal((await detail('serum-order-explained')).status, 200);
        assert.equal((await detail('how-to-layer-serums', slugs.pro)).body.data.body, '<p>Mine</p>');
        items.twin = renamed;
    });

    test('new items come first; the owner sets the whole order; the public sees the published ones in it, by kind too', async () => {
        const list = await mine();
        assert.deepEqual(list.rows.slice(0, 2).map((r) => r.id), [items.twin.id, items.draft.id], 'newest first');
        assert.ok(!('body' in list.rows[0]), 'lists leave the text out');
        const order = list.rows.map((r) => r.id).toReversed();
        const res = await app.request('PUT', '/api/v1/my/profile/education/order', { body: { ids: order }, token: tokens.brand });
        assert.deepEqual([res.status, res.body.data], [200, { ok: true }]);
        assert.deepEqual((await mine()).rows.map((r) => r.id), order);
        assert.deepEqual((await published()).rows.map((r) => r.id), order.filter((id) => id !== items.draft.id));
        assert.deepEqual((await published(slugs.brand, 'kind=video')).rows.map((r) => r.kind), ['video', 'video', 'video']);
        assert.ok((await published(slugs.brand, 'kind=article')).rows.every((r) => r.kind === 'article'));
        assert.deepEqual((await app.request('PUT', '/api/v1/my/profile/education/order', { body: { ids: order.slice(1) }, token: tokens.brand })).body.details, { field: 'ids' });

        const page = (await app.request('GET', `/api/v1/profiles/${slugs.brand}`)).body.data;
        assert.equal(page.education.count, (await published()).count);
        assert.deepEqual(page.education.rows.map((r) => r.id), order.filter((id) => id !== items.draft.id).slice(0, 3));
        assert.equal(page.quick_info.has_education, true);
    });
});

describe('editing and deleting', () => {
    test('a form that sends back what it was shown changes nothing; a new cover replaces the old file; a video item can become an article and back', async () => {
        const same = await edit(items.youtube.id, { title: 'Morning Routine', cover_image: items.youtube.cover_image, summary: '' });
        assert.equal(same.status, 200, same.body.message);
        assert.deepEqual([same.body.data.slug, same.body.data.cover_image], [items.youtube.slug, items.youtube.video.thumbnail]);

        const oldCover = items.article.cover_image;
        const recovered = await edit(items.article.id, {}, { images: [photo('new-cover.png')] });
        assert.notEqual(recovered.body.data.cover_image, oldCover);
        assert.ok(await removed(oldCover), 'the old cover is deleted');
        const cleared = await edit(items.article.id, { cover_image: '' });
        assert.equal(cleared.body.data.cover_image, null);
        assert.ok(await removed(recovered.body.data.cover_image));

        const kept = await edit(items.upload.id, { title: 'Peel Tutorial, Updated' });
        assert.deepEqual(kept.body.data.video, items.upload.video, 'an edit without video fields keeps the video');
        const article = await edit(items.upload.id, { kind: 'article', body: '<p>Now in words.</p>' });
        assert.equal(article.status, 200, article.body.message);
        assert.deepEqual([article.body.data.kind, article.body.data.video, article.body.data.cover_image], ['article', null, null]);
        assert.ok(await removed(items.upload.video.url), 'the video it owned is deleted');
        assert.ok(await removed(items.upload.video.thumbnail), 'and its poster');
        assert.deepEqual((await edit(items.upload.id, { kind: 'video' })).body.details, { field: 'video_url' }, 'a video needs one');
        const back = await edit(items.upload.id, { kind: 'video', video_url: 'https://youtu.be/ccccccccccc' });
        assert.deepEqual([back.body.data.kind, back.body.data.video.source, back.body.data.body], ['video', 'youtube', '<p>Now in words.</p>']);
    });

    test('deleting removes the item\'s own files, not one the page still shows; another page\'s item is 404', async () => {
        const res = await add({ kind: 'video', title: 'Short Clip' }, { videos: [video('short.mp4')], video_thumbnails: [photo('short.png')], images: [photo('short-cover.png')] });
        const clip = res.body.data;
        const page = await app.request('PUT', '/api/v1/my/profile', { body: { about_image: clip.cover_image }, token: tokens.brand });
        assert.equal(page.status, 200, page.body.message);
        const gone = await app.request('DELETE', `/api/v1/my/profile/education/${clip.id}`, { token: tokens.brand });
        assert.deepEqual([gone.status, gone.body.data], [200, { deleted: true }]);
        assert.ok(await removed(clip.video.url));
        assert.ok(await removed(clip.video.thumbnail));
        await new Promise((resolve) => setTimeout(resolve, 100));
        assert.ok(exists(clip.cover_image), 'still the page\'s About image');

        assert.equal((await app.request('GET', `/api/v1/my/profile/education/${clip.id}`, { token: tokens.brand })).status, 404);
        assert.equal((await app.request('DELETE', `/api/v1/my/profile/education/${items.article.id}`, { token: tokens.pro })).status, 404);
        assert.equal((await edit(items.article.id, { title: 'Taken over' }, {}, tokens.pro)).status, 404);
    });
});

describe('admins', () => {
    test('admins add, read, edit, order and delete any page\'s items, and upload images for their text', async () => {
        const base = `/api/v1/profiles/admin/${ids.pro}/education`;
        const added = await app.form('POST', base, { fields: { kind: 'article', title: 'Editors\' Pick', body: '<p>From Glamlink.</p>', status: 'draft' }, headers: auth });
        assert.equal(added.status, 201, added.body.message);
        const [{ byAdmin }] = await q('SELECT created_by_admin AS byAdmin FROM profile_education WHERE id = ?', [added.body.data.id]);
        assert.equal(Number(byAdmin), 1);
        const one = await app.request('GET', `${base}/${added.body.data.id}`, { headers: auth });
        assert.deepEqual([one.status, one.body.data.body, one.body.data.status], [200, '<p>From Glamlink.</p>', 'draft']);
        const shown = await app.request('PUT', `${base}/${added.body.data.id}`, { body: { status: 'published' }, headers: auth });
        assert.equal(shown.body.data.status, 'published');
        const list = (await app.request('GET', base, { headers: auth })).body.data;
        assert.equal(list.count, 2);
        const order = list.rows.map((r) => r.id).toReversed();
        assert.equal((await app.request('PUT', `${base}/order`, { body: { ids: order }, headers: auth })).status, 200);
        assert.deepEqual((await published(slugs.pro)).rows.map((r) => r.id), order);
        const upload = await app.form('POST', `/api/v1/profiles/admin/${ids.pro}/uploads`, { files: { images: [photo()] }, headers: auth });
        assert.equal(upload.status, 201, upload.body.message);
        assert.ok(upload.body.data.location.startsWith(`${API}/images/`));
        assert.equal((await app.request('DELETE', `${base}/${added.body.data.id}`, { headers: auth })).status, 200);

        assert.equal((await app.request('GET', base)).status, 401);
        assert.equal((await app.request('GET', base, { token: tokens.pro })).status, 401, 'an owner\'s token is not an admin\'s');
        assert.equal((await app.request('GET', `/api/v1/profiles/admin/${ids.user}/education`, { headers: auth })).status, 404, 'not a professional account');
        assert.equal((await app.request('GET', `${base}/${items.article.id}`, { headers: auth })).status, 404, 'another page\'s item');
    });
});
