// Watch (Phase 6): videos by series, imported from each series' YouTube playlist or pasted by admins, with their
// people and topics; listed on the Watch page, profile pages and topic pages (website/watch, migration
// 20261023-1000). YouTube is replaced by a fake.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const config = require('../src/core/config/config');
const httpClient = require('../src/core/http/httpClient');
const { youtube, videoIdFrom, seconds } = require('../src/integrations/youtube');

let app, q, insert, auth, topicId;
const ids = {};
const stamp = `${Date.now()}`.slice(-8);
const PODCAST_PLAYLIST = 'PLJPmuOJKw5YbrNAxnyi7SuQx9gNisadgY';
const yt = (n) => `v${stamp}${n}`.slice(0, 11).padEnd(11, 'x');
const real = { ...youtube };

// What the fake YouTube holds: three public videos, one private, a playlist with two of them and the private one.
const VIDEOS = {
    [yt(1)]: { title: 'Glow Up Secrets', published: '2026-09-01T10:00:00Z', duration: 'PT45M10S' },
    [yt(2)]: { title: 'Lash Talk', published: '2026-10-01T10:00:00Z', duration: 'PT30M' },
    [yt(3)]: { title: 'Injector Expert Take', published: '2026-08-01T10:00:00Z', duration: 'PT8M5S' },
    [yt(4)]: { title: 'Private one', published: '2026-10-05T10:00:00Z', duration: 'PT1M', private: true },
};

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    config.YOUTUBE_API_KEY = 'test-key';
    youtube.playlistVideoIds = async (playlist) => {
        if (playlist === PODCAST_PLAYLIST) return [yt(2), yt(1), yt(4)];
        throw new Error(`playlist ${playlist} not found`);
    };
    youtube.videoDetails = async (wanted) => wanted
        .filter((id) => VIDEOS[id] && !VIDEOS[id].private)
        .map((id) => ({
            youtube_id: id, title: VIDEOS[id].title, description: `About ${VIDEOS[id].title}`, thumbnail: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
            published_at: new Date(VIDEOS[id].published), duration_seconds: seconds(VIDEOS[id].duration),
        }));

    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (7, 'Professional', 'PRO')");
    ids.host = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active) VALUES (?, 7, 'professional', 'individual', 'ACCEPTED', 1)", [`host-${stamp}@videos.example`]);
    await insert('INSERT INTO profiles (user_id, email, name) VALUES (?, ?, ?)', [ids.host, `host-${stamp}@videos.example`, 'Vault Host']);
    await insert("INSERT INTO business_cards (user_id, name, status, slug, business_card_link) VALUES (?, 'Vault Host', 'accepted', ?, ?)", [ids.host, `vaulthost${stamp}`, `https://glamlink.net/access/vaulthost${stamp}`]);
    topicId = await insert('INSERT INTO journal_topics (name, slug) VALUES (?, ?)', [`Lashes ${stamp}`, `lashes-${stamp}`]);
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Videos Admin', ?, 1, 1)", [`videos-admin-${stamp}@test.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
});
after(async () => {
    Object.assign(youtube, real);
    config.YOUTUBE_API_KEY = undefined;
    await app.close();
});

const admin = (method, path, body) => app.request(method, `/api/v1${path}`, { body, headers: auth });
const videos = async (query = '') => (await app.request('GET', `/api/v1/videos?${query}`)).body.data;
const titles = (data) => data.rows.map((row) => row.title);
const mine = (data) => titles(data).filter((t) => ['Glow Up Secrets', 'Lash Talk', 'Injector Expert Take'].includes(t));
const seriesId = async (slug) => (await q('SELECT id FROM video_series WHERE slug = ?', [slug]))[0].id;
const videoOf = async (n) => (await q('SELECT id, slug FROM videos WHERE youtube_id = ?', [yt(n)]))[0];

describe('YouTube links', () => {
    test('a video id is read from every kind of link', () => {
        for (const link of ['https://www.youtube.com/watch?v=abcdefghijk&t=10', 'https://youtu.be/abcdefghijk', 'https://youtube.com/shorts/abcdefghijk', 'https://www.youtube.com/embed/abcdefghijk', 'abcdefghijk']) {
            assert.equal(videoIdFrom(link), 'abcdefghijk', link);
        }
        assert.equal(videoIdFrom('https://vimeo.com/123'), null);
        assert.equal(seconds('PT1H2M3S'), 3723);
    });
});

describe('the series', () => {
    test('the four series of the home page start, in order', async () => {
        const res = await app.request('GET', '/api/v1/video-series');
        assert.deepEqual(res.body.data.map((s) => s.name), ['Beauty Vault Podcast', 'Expert Take', 'Treatment Spotlight', 'Industry Voices']);
    });
});

describe('importing', () => {
    test('a sync imports each playlist\'s public videos once; a bad playlist does not stop the others', async () => {
        await admin('PUT', `/video-series/admin/${await seriesId('expert-take')}`, { playlist_id: 'https://www.youtube.com/playlist?list=PLbrokenplaylist1' });
        const first = await admin('POST', '/videos/admin/sync');
        assert.equal(first.status, 200, first.body.message);
        assert.equal(first.body.data.imported, 2);
        assert.deepEqual(first.body.data.series.find((s) => s.series === 'beauty-vault-podcast'), { series: 'beauty-vault-podcast', imported: 2 });
        assert.match(first.body.data.series.find((s) => s.series === 'expert-take').error, /not found/);
        assert.equal((await admin('POST', '/videos/admin/sync')).body.data.imported, 0, 'nothing twice');
    });

    test('a playlist that ends with an empty page pointing at itself is read once, not forever', async () => {
        // YouTube's answer for the Beauty Vault playlist (Oct 23): full pages, then an empty one whose next token is its own.
        const PAGES = {
            first: { ids: [yt(1), yt(2)], next: 'PAGE2' },
            PAGE2: { ids: [yt(3)], next: 'PAGE3' },
            PAGE3: { ids: [], next: 'PAGE3' },
        };
        const asked = [];
        const get = httpClient.get;
        httpClient.get = async (url, { params }) => {
            const token = params.pageToken ?? 'first';
            asked.push(token);
            return { data: { items: PAGES[token].ids.map((videoId) => ({ contentDetails: { videoId } })), nextPageToken: PAGES[token].next } };
        };
        try {
            assert.deepEqual(await real.playlistVideoIds(PODCAST_PLAYLIST), [yt(1), yt(2), yt(3)]);
            assert.deepEqual(asked, ['first', 'PAGE2', 'PAGE3']);
        } finally {
            httpClient.get = get;
        }
    });

    test('an admin pastes a link; the same link again answers the video already here', async () => {
        const res = await admin('POST', '/videos/admin/import', { url: `https://youtu.be/${yt(3)}`, series_id: await seriesId('expert-take') });
        assert.equal(res.status, 201, res.body.message);
        assert.deepEqual([res.body.data.created, res.body.data.video.title, res.body.data.video.duration_seconds], [true, 'Injector Expert Take', 485]);
        const again = await admin('POST', '/videos/admin/import', { url: yt(3) });
        assert.deepEqual([again.status, again.body.data.created], [200, false]);
        assert.deepEqual((await admin('POST', '/videos/admin/import', { url: yt(4) })).body.details, { field: 'url' }, 'a private video');
        assert.deepEqual((await admin('POST', '/videos/admin/import', { url: 'https://vimeo.com/1' })).body.details, { field: 'url' });
    });

    test('without the key, or with YouTube down, the admin is told', async () => {
        config.YOUTUBE_API_KEY = '';
        assert.equal((await admin('POST', '/videos/admin/sync')).body.code, 'YOUTUBE_NOT_CONFIGURED');
        config.YOUTUBE_API_KEY = 'test-key';
        const details = youtube.videoDetails;
        youtube.videoDetails = async () => { throw new Error('quota'); };
        const res = await admin('POST', '/videos/admin/import', { url: 'zyxwvutsrqp' });
        youtube.videoDetails = details;
        assert.deepEqual([res.status, res.body.code], [502, 'YOUTUBE_UNAVAILABLE']);
    });
});

describe('the Watch page', () => {
    test('lists published videos newest first, by series, and searches them', async () => {
        assert.deepEqual(mine(await videos('limit=50')), ['Lash Talk', 'Glow Up Secrets', 'Injector Expert Take']);
        assert.deepEqual(mine(await videos('series=beauty-vault-podcast&limit=50')), ['Lash Talk', 'Glow Up Secrets']);
        assert.deepEqual(mine(await videos('search=injector')), ['Injector Expert Take']);
        const card = (await videos('series=expert-take')).rows[0];
        assert.deepEqual(card.series, { id: await seriesId('expert-take'), name: 'Expert Take', slug: 'expert-take' });
        assert.equal(card.youtube_id, yt(3));
    });

    test('admins hide a video and feature one for the home row', async () => {
        const glow = await videoOf(1);
        await admin('PUT', `/videos/admin/${glow.id}`, { status: 'draft' });
        assert.ok(!titles(await videos('limit=50')).includes('Glow Up Secrets'));
        assert.equal((await app.request('GET', `/api/v1/videos/${glow.slug}`)).status, 404);
        await admin('PUT', `/videos/admin/${glow.id}`, { status: 'published' });
        const lash = await videoOf(2);
        await admin('PUT', `/videos/admin/${lash.id}`, { is_featured: 'true', featured_order: '1' });
        assert.deepEqual(titles(await videos('featured=true')).filter((t) => t === 'Lash Talk'), ['Lash Talk']);
        assert.equal((await admin('PUT', `/videos/admin/${lash.id}`, { status: 'live' })).body.code, 'INVALID_VIDEO');
    });
});

describe('people and topics', () => {
    test('a video names its people and topics; profile and topic pages list it', async () => {
        const lash = await videoOf(2);
        assert.equal((await admin('PUT', `/videos/admin/${lash.id}/people`, { people: [{ user_id: ids.host, role: 'host' }] })).status, 200);
        assert.equal((await admin('PUT', `/videos/admin/${lash.id}/topics`, { topic_ids: [topicId] })).status, 200);
        const res = await app.request('GET', `/api/v1/videos/${lash.slug}`);
        assert.equal(res.status, 200);
        const v = res.body.data;
        assert.deepEqual(v.people, [{ id: ids.host, slug: `vaulthost${stamp}`, name: 'Vault Host', type: 'individual', role: 'host' }]);
        assert.deepEqual(v.topics, [{ id: topicId, name: `Lashes ${stamp}`, slug: `lashes-${stamp}` }]);
        assert.equal(v.embed_url, `https://www.youtube.com/embed/${yt(2)}`);
        assert.deepEqual(v.related.map((r) => r.title), ['Glow Up Secrets'], 'the rest of its series');

        const page = await app.request('GET', `/api/v1/profiles/vaulthost${stamp}`);
        assert.deepEqual(page.body.data.videos.rows.map((r) => r.title), ['Lash Talk']);
        assert.equal((await app.request('GET', `/api/v1/profiles/vaulthost${stamp}/videos`)).body.data.count, 1);
        const topic = await app.request('GET', `/api/v1/journal/topic/${topicId}`);
        assert.deepEqual(topic.body.data.videos.map((r) => r.title), ['Lash Talk']);

        assert.equal((await admin('PUT', `/videos/admin/${lash.id}/people`, { people: [{ user_id: ids.host, role: 'star' }] })).status, 400);
    });
});
