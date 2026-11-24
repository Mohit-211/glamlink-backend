// A topic's page and its items (Mohit, Nov 24). The public page shows only what is public (W-1: professionals whose
// page shows, each card as anyone may see it; A-CNT-3: published articles, products and paragraphs), and now brands.
// Admins list, add, remove and order a topic's articles, videos, professionals, brands and products; an item taken off
// is remembered as rejected. Saving an article with its topics works again (A-CNT-1) (website/content).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');

let app, q, insert, auth, topic;
const stamp = `${Date.now()}`.slice(-8);
const ids = {};

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (7, 'Professional', 'PRO'), (8, 'Brand', 'BRND')");
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Topics Admin', ?, 1, 1)", [`topics-admin-${stamp}@test.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };

    topic = await insert('INSERT INTO journal_topics (name, slug, description) VALUES (?, ?, ?)', [`Retinol ${stamp}`, `retinol-${stamp}`, 'Vitamin A for skin.']);
    ids.author = await insert("INSERT INTO authors (name) VALUES ('Topic Writer')");
    const article = (title, status, date) => insert("INSERT INTO journals (title, author_id, slug, status, publish_date, short_description, content) VALUES (?, ?, ?, ?, ?, 'About it', '<p>Text</p>')",
        [`${title} ${stamp}`, ids.author, `${title.toLowerCase().replace(/\W+/g, '-')}-${stamp}`, status, date]);
    ids.older = await article('Retinol Basics', 'published', '2026-01-10');
    ids.newer = await article('Retinol Myths', 'published', '2026-06-01');
    ids.draft = await article('Retinol Draft', 'draft', '2026-07-01');
    const product = (title, status) => insert('INSERT INTO shops (title, status) VALUES (?, ?)', [`${title} ${stamp}`, status]);
    ids.serum = await product('Night Serum', 'published');
    ids.cream = await product('Day Cream', 'published');
    ids.draftProduct = await product('Secret Serum', 'draft');

    const account = async (name, type, { card = true, listed = true, phone = 0 } = {}) => {
        const email = `${name.toLowerCase().replace(/\W/g, '')}-${stamp}@topic.example`;
        const id = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active) VALUES (?, ?, 'professional', ?, 'ACCEPTED', 1)",
            [email, type === 'brand' ? 8 : 7, type]);
        await insert('INSERT INTO profiles (user_id, email, name) VALUES (?, ?, ?)', [id, email, name]);
        if (card) {
            const slug = `${name.toLowerCase().replace(/\W/g, '')}${stamp}`;
            await insert(`INSERT INTO business_cards (user_id, name, business_name, email, phone, is_phone_visible, status, slug, business_card_link, plan_type,
                offer_promotion, promotion_details)
                VALUES (?, ?, ?, ?, '7025550111', ?, 'accepted', ?, ?, 'subscription_only', 1, 'Retired offer')`, [id, name, `${name} Co`, `${slug}@card.example`, phone, slug, `https://glamlink.net/access/${slug}`]);
        }
        if (!listed) await insert('INSERT INTO profile_pages (user_id, is_listed) VALUES (?, 0)', [id]);
        return { id, email };
    };
    ids.pro = await account('Skin Doc', 'individual');
    ids.unlisted = await account('Quiet Doc', 'individual', { listed: false });
    ids.cardless = await account('Old Doc', 'individual', { card: false });
    ids.brand = await account('Retinal Labs', 'brand');
    // A series of its own, not active, so the public list of series stays the four (test/videos.test.js).
    const series = await insert('INSERT INTO video_series (name, slug, sort_order, is_active) VALUES (?, ?, 9, 0)', [`Series ${stamp}`, `series-${stamp}`]);
    let clip = 0;
    const video = (title, status, date) => insert('INSERT INTO videos (series_id, youtube_id, title, slug, status, published_at) VALUES (?, ?, ?, ?, ?, ?)',
        [series, `yt${++clip}x${stamp}`, `${title} ${stamp}`, `${title.toLowerCase().replace(/\W+/g, '-')}-${stamp}`, status, date]);
    ids.video = await video('Retinol Talk', 'published', '2026-05-01');
    ids.newVideo = await video('Retinol Live', 'published', '2026-08-01');
    ids.draftVideo = await video('Retinol Cut', 'draft', '2026-09-01');

    // On the topic before any of the new calls: articles (from their side), products, professionals, a brand, videos.
    for (const [journal, order] of [[ids.older, 1], [ids.newer, 2], [ids.draft, 1]]) {
        await insert('INSERT INTO journal_topic_mappings (journal_id, topic_id, sort_order) VALUES (?, ?, ?)', [journal, topic, order]);
    }
    for (const [shop, order] of [[ids.cream, 2], [ids.serum, 1], [ids.draftProduct, 3]]) {
        await insert('INSERT INTO journal_topic_product_mappings (topic_id, shop_id, sort_order) VALUES (?, ?, ?)', [topic, shop, order]);
    }
    for (const [user, order] of [[ids.unlisted.id, 1], [ids.pro.id, 2], [ids.cardless.id, 3], [ids.brand.id, 4]]) {
        await insert('INSERT INTO journal_topic_professional_mappings (topic_id, user_id, sort_order) VALUES (?, ?, ?)', [topic, user, order]);
    }
    for (const clipId of [ids.video, ids.newVideo, ids.draftVideo]) {
        await insert('INSERT INTO journal_topic_video_mappings (topic_id, video_id, sort_order) VALUES (?, ?, 1)', [topic, clipId]);
    }
});
after(() => app.close());

const page = (headers) => app.request('GET', `/api/v1/journal/topic/${topic}`, { headers });
const items = () => app.request('GET', `/api/v1/journal/topic/${topic}/items`, { headers: auth });
const titles = (rows) => rows.map((row) => row.title ?? row.name);

describe('the public topic page (W-1, A-CNT-3)', () => {
    test('published articles newest first, published products in the topic\'s order, published videos newest first', async () => {
        const res = await page();
        assert.equal(res.status, 200, res.body.message);
        const data = res.body.data;
        assert.deepEqual(titles(data.journals), [`Retinol Myths ${stamp}`, `Retinol Basics ${stamp}`]);
        assert.deepEqual(titles(data.shops), [`Night Serum ${stamp}`, `Day Cream ${stamp}`]);
        assert.deepEqual(titles(data.videos), [`Retinol Live ${stamp}`, `Retinol Talk ${stamp}`]);
    });

    test('professionals whose page shows, each card only as anyone may see it; brands as the Brands page lists them', async () => {
        const data = (await page()).body.data;
        assert.deepEqual(data.professionals.map((p) => [p.id, p.name, p.slug]), [[ids.pro.id, 'Skin Doc', `skindoc${stamp}`]]);
        const card = data.professionals[0].business_card;
        assert.equal(card.name, 'Skin Doc');
        for (const field of ['plan_type', 'user_id', 'business_user', 'claimed_place_id', 'offer_promotion', 'promotion_details']) assert.equal(card[field], undefined, field);
        assert.equal(card.phone, null, 'the phone its owner hides');
        assert.ok(!JSON.stringify(data).includes(ids.pro.email), 'no account email');
        assert.deepEqual(data.brands.map((b) => [b.id, b.name, b.type, b.slug]), [[ids.brand.id, 'Retinal Labs Co', 'brand', `retinallabs${stamp}`]]);
    });

    test('an admin sees drafts, hidden pages, emails and whole cards', async () => {
        const data = (await page(auth)).body.data;
        assert.deepEqual(titles(data.journals), [`Retinol Draft ${stamp}`, `Retinol Myths ${stamp}`, `Retinol Basics ${stamp}`]);
        assert.ok(titles(data.shops).includes(`Secret Serum ${stamp}`));
        assert.deepEqual(data.professionals.map((p) => p.id), [ids.unlisted.id, ids.pro.id, ids.cardless.id]);
        const pro = data.professionals.find((p) => p.id === ids.pro.id);
        assert.deepEqual([pro.email, pro.business_card.plan_type, pro.business_card.offer_promotion], [ids.pro.email, 'subscription_only', undefined]);
        assert.equal(data.professionals.find((p) => p.id === ids.cardless.id).business_card, null);
    });

    test('paragraphs come from published articles only, for the public', async () => {
        for (const journal of [ids.newer, ids.draft]) {
            await insert('INSERT INTO journal_topic_paragraph_mappings (journal_id, topic_id, paragraph_id, sort_order) VALUES (?, ?, ?, 1)', [journal, topic, `p-${journal}`]);
        }
        const shown = (await app.request('GET', `/api/v1/journal/topic/${topic}/paragraphs`)).body.data;
        assert.deepEqual(shown.map((p) => Number(p.journal_id)), [ids.newer]);
        const all = (await app.request('GET', `/api/v1/journal/topic/${topic}/paragraphs`, { headers: auth })).body.data;
        assert.equal(all.length, 2);
    });
});

describe('saving an article with its topics (A-CNT-1)', () => {
    test('keeps the links, adds new ones and brings back links deleted softly before', async () => {
        const other = await insert('INSERT INTO journal_topics (name, slug) VALUES (?, ?)', [`Peels ${stamp}`, `peels-${stamp}`]);
        // What the bug left behind: the article's link deleted softly.
        await insert('INSERT INTO journal_topic_mappings (journal_id, topic_id, sort_order, deleted_at) VALUES (?, ?, 2, NOW())', [ids.older, other]);
        const res = await app.request('POST', `/api/v1/journal/${ids.older}/topics`, { body: { topic_ids: [other, topic] }, headers: auth });
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual(res.body.data.map((m) => Number(m.topic_id)), [other, topic]);
        const saved = await app.request('PUT', `/api/v1/journal/${ids.older}`, { body: { topic_ids: [topic] }, headers: auth });
        assert.equal(saved.status, 200, saved.body.message);
        const links = await q('SELECT topic_id, deleted_at FROM journal_topic_mappings WHERE journal_id = ? ORDER BY topic_id', [ids.older]);
        assert.deepEqual(links.map((l) => [Number(l.topic_id), l.deleted_at]), [[topic, null]], 'the dropped topic\'s link is gone for good');
    });

    test('the migration brings back the links a failed save took away', async () => {
        const lonely = await insert("INSERT INTO journals (title, author_id, slug, status, content) VALUES (?, ?, ?, 'published', '<p>Text</p>')", [`Lost Links ${stamp}`, ids.author, `lost-links-${stamp}`]);
        const gone = '2026-10-30 10:00:00';
        const acne = await insert('INSERT INTO journal_topics (name, slug) VALUES (?, ?)', [`Acne ${stamp}`, `acne-${stamp}`]);
        const scars = await insert('INSERT INTO journal_topics (name, slug) VALUES (?, ?)', [`Scars ${stamp}`, `scars-${stamp}`]);
        await insert('INSERT INTO journal_topic_mappings (journal_id, topic_id, sort_order, deleted_at) VALUES (?, ?, 1, ?)', [lonely, acne, gone]);
        await insert('INSERT INTO journal_topic_mappings (journal_id, topic_id, sort_order, deleted_at) VALUES (?, ?, 2, ?)', [lonely, scars, gone]);
        const logged = [];
        await require('../src/core/db/migrations/20261124-0200-topic-ai').up({ sequelize: app.sequelize, log: (line) => logged.push(line) });
        const links = await q('SELECT deleted_at FROM journal_topic_mappings WHERE journal_id = ?', [lonely]);
        assert.deepEqual(links.map((l) => l.deleted_at), [null, null]);
        assert.ok(logged.some((line) => line.includes(String(lonely))));
    });
});

describe('a topic\'s items, for admins', () => {
    test('every kind with where it came from; articles and videos newest first; admins only', async () => {
        assert.equal((await app.request('GET', `/api/v1/journal/topic/${topic}/items`)).status, 401);
        const res = await items();
        assert.equal(res.status, 200, res.body.message);
        const data = res.body.data;
        assert.deepEqual(data.topic, { id: topic, name: `Retinol ${stamp}`, slug: `retinol-${stamp}` });
        assert.deepEqual(titles(data.items.article), [`Retinol Draft ${stamp}`, `Retinol Myths ${stamp}`, `Retinol Basics ${stamp}`]);
        assert.deepEqual(data.items.article.map((a) => [a.status, a.source, a.ai]), [['draft', 'admin', null], ['published', 'admin', null], ['published', 'admin', null]]);
        assert.deepEqual(titles(data.items.video), [`Retinol Cut ${stamp}`, `Retinol Live ${stamp}`, `Retinol Talk ${stamp}`]);
        assert.deepEqual(data.items.professional.map((p) => [p.id, p.status]), [[ids.unlisted.id, 'hidden'], [ids.pro.id, 'visible'], [ids.cardless.id, 'hidden']]);
        assert.deepEqual(data.items.brand.map((b) => b.id), [ids.brand.id]);
        assert.deepEqual(titles(data.items.product), [`Night Serum ${stamp}`, `Day Cream ${stamp}`, `Secret Serum ${stamp}`]);
        assert.deepEqual(data.suggestions, { article: [], video: [], professional: [], brand: [], product: [] });
    });

    test('adding: one or many, each once, at the end; what cannot go on a topic is refused', async () => {
        const fresh = await insert("INSERT INTO shops (title, status) VALUES (?, 'published')", [`Eye Balm ${stamp}`]);
        const res = await app.request('POST', `/api/v1/journal/topic/${topic}/items`, { body: { items: [{ type: 'product', id: fresh }, { type: 'product', id: ids.serum }] }, headers: auth });
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual(titles(res.body.data.items.product), [`Night Serum ${stamp}`, `Day Cream ${stamp}`, `Secret Serum ${stamp}`, `Eye Balm ${stamp}`]);
        ids.balm = fresh;
        const refusal = async (body) => {
            const r = await app.request('POST', `/api/v1/journal/topic/${topic}/items`, { body, headers: auth });
            return [r.status, r.body.code, r.body.details?.field];
        };
        assert.deepEqual(await refusal({ type: 'brand', id: ids.pro.id }), [400, 'INVALID_TOPIC_ITEM', 'id'], 'a professional is not a brand');
        assert.deepEqual(await refusal({ type: 'podcast', id: 1 }), [400, 'INVALID_TOPIC_ITEM', 'type']);
        assert.deepEqual(await refusal({ type: 'article', id: 'x' }), [400, 'INVALID_TOPIC_ITEM', 'id']);
        assert.deepEqual(await refusal({ items: [] }), [400, 'INVALID_TOPIC_ITEM', 'items']);
        assert.equal((await app.request('POST', '/api/v1/journal/topic/99999999/items', { body: { type: 'article', id: ids.older }, headers: auth })).status, 404);
    });

    test('ordering the topic\'s own lists: these first, the rest after; articles and videos are not ordered here', async () => {
        const res = await app.request('PUT', `/api/v1/journal/topic/${topic}/items/product/order`, { body: { ids: [ids.balm, ids.cream] }, headers: auth });
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual(titles(res.body.data.items.product), [`Eye Balm ${stamp}`, `Day Cream ${stamp}`, `Night Serum ${stamp}`, `Secret Serum ${stamp}`]);
        assert.deepEqual(titles((await page()).body.data.shops), [`Eye Balm ${stamp}`, `Day Cream ${stamp}`, `Night Serum ${stamp}`], 'the public page follows');
        const articles = await app.request('PUT', `/api/v1/journal/topic/${topic}/items/article/order`, { body: { ids: [ids.older] }, headers: auth });
        assert.deepEqual([articles.status, articles.body.details], [400, { field: 'type' }]);
        const stranger = await app.request('PUT', `/api/v1/journal/topic/${topic}/items/product/order`, { body: { ids: [99999999] }, headers: auth });
        assert.deepEqual([stranger.status, stranger.body.details], [400, { field: 'ids' }]);
    });

    test('taking one off removes it for good and remembers the admin rejected it', async () => {
        const res = await app.request('DELETE', `/api/v1/journal/topic/${topic}/items/video/${ids.video}`, { headers: auth });
        assert.equal(res.status, 200, res.body.message);
        assert.ok(!res.body.data.items.video.some((v) => v.id === ids.video));
        const [memory] = await q("SELECT status FROM journal_topic_ai_items WHERE topic_id = ? AND item_type = 'video' AND item_id = ?", [topic, ids.video]);
        assert.equal(memory.status, 'rejected');
        assert.equal((await app.request('DELETE', `/api/v1/journal/topic/${topic}/items/video/${ids.video}`, { headers: auth })).status, 404);
        // Put back by hand, the rejection is forgotten.
        await app.request('POST', `/api/v1/journal/topic/${topic}/items`, { body: { type: 'video', id: ids.video }, headers: auth });
        assert.equal((await q("SELECT COUNT(*) AS n FROM journal_topic_ai_items WHERE topic_id = ? AND item_type = 'video' AND item_id = ?", [topic, ids.video]))[0].n, 0);
    });

    test('the professionals picker keeps the topic\'s brands, and the brands picker its professionals', async () => {
        const pros = await app.request('PUT', `/api/v1/journal/topic/${topic}/professionals`, { body: { professional_ids: [ids.pro.id] }, headers: auth });
        assert.equal(pros.status, 200, pros.body.message);
        assert.deepEqual(pros.body.data.professionals.map((p) => p.id), [ids.pro.id]);
        assert.deepEqual(pros.body.data.brands.map((b) => b.id), [ids.brand.id], 'the brand stays');
        const brands = await app.request('PUT', `/api/v1/journal/topic/${topic}/brands`, { body: { brand_ids: [] }, headers: auth });
        assert.deepEqual([brands.body.data.professionals.map((p) => p.id), brands.body.data.brands], [[ids.pro.id], []]);
        const wrong = await app.request('PUT', `/api/v1/journal/topic/${topic}/brands`, { body: { brand_ids: [ids.pro.id] }, headers: auth });
        assert.deepEqual([wrong.status, wrong.body.message], [400, 'One or more brand IDs are invalid']);
        assert.equal((await app.request('PUT', `/api/v1/journal/topic/${topic}/brands`, { body: { brand_ids: [ids.brand.id] }, headers: auth })).status, 200);
    });
});
