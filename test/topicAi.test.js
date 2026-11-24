// The topics' AI (Mohit, Nov 24): a run reads the site's published articles and videos, the visible professional and
// brand pages and the published products, and asks the model (OpenAI's Responses API with a strict JSON schema, faked
// here) which belong on the topic. An apply run puts its picks on the topic with their reasons; a suggest run leaves them
// for an admin. What an admin took off is never offered again; one run at a time per topic (website/content).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const config = require('../src/core/config/config');
const openai = require('../src/integrations/openai');
const httpClient = require('../src/core/http/httpClient');
const topicAi = require('../src/website/content/topicAi.service');

let app, q, insert, auth, topic;
const stamp = `${Date.now()}`.slice(-8);
// The words the fake model goes by: KEY belongs on the topic (90), LOOSE only loosely (50).
const KEY = `bakuchiol${stamp}`;
const LOOSE = `squalane${stamp}`;
const ids = {};
const realJson = openai.responses.json;
const calls = [];
let behave = null;

// The items a request offered (one JSON object per line of its input).
const offered = (request) => request.input.split('\n').filter((line) => line.startsWith('{')).map((line) => JSON.parse(line));
const answer = (request) => {
    const items = offered(request);
    const picks = [
        ...items.filter((item) => item.text.includes(KEY)).map((item) => ({ id: item.id, score: 90, reason: `It is about ${KEY}.` })),
        ...items.filter((item) => item.text.includes(LOOSE)).map((item) => ({ id: item.id, score: 50, reason: 'Loosely related.' })),
        { id: 99999999, score: 99, reason: 'An id the list did not have.' },
    ];
    return { value: { picks }, usage: { input_tokens: 1000, output_tokens: 100 } };
};

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    openai.responses.json = async (request) => {
        calls.push(request);
        return behave ? behave(request) : answer(request);
    };
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (7, 'Professional', 'PRO'), (8, 'Brand', 'BRND')");
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('AI Admin', ?, 1, 1)", [`ai-admin-${stamp}@test.example`]);
    ids.admin = admin;
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };

    topic = await insert('INSERT INTO journal_topics (name, slug, description) VALUES (?, ?, ?)', [`Gentle retinoids ${stamp}`, `gentle-retinoids-${stamp}`, `Plant alternatives such as ${KEY}.`]);
    const author = await insert("INSERT INTO authors (name) VALUES ('AI Writer')");
    const article = (title, status = 'published') => insert("INSERT INTO journals (title, author_id, slug, status, content) VALUES (?, ?, ?, ?, ?)",
        [`${title} ${stamp}`, author, `${title.toLowerCase().replace(/\W+/g, '-')}-${stamp}`, status, `<p>${title}</p>`]);
    ids.article = await article(`All about ${KEY}`);
    ids.loose = await article(`Oils with ${LOOSE}`);
    ids.draftArticle = await article(`Draft on ${KEY}`, 'draft');
    // A series of its own, not active, so the public list of series stays the four (test/videos.test.js).
    const series = await insert('INSERT INTO video_series (name, slug, sort_order, is_active) VALUES (?, ?, 9, 0)', [`AI Series ${stamp}`, `ai-series-${stamp}`]);
    let clip = 0;
    const video = (title, status = 'published') => insert('INSERT INTO videos (series_id, youtube_id, title, slug, status, description) VALUES (?, ?, ?, ?, ?, ?)',
        [series, `ai${++clip}x${stamp}`, `${title} ${stamp}`, `ai-${clip}-${stamp}`, status, `An episode on ${title}`]);
    ids.video = await video(`${KEY} at night`);
    ids.draftVideo = await video(`${KEY} outtakes`, 'draft');
    const account = async (name, type, { listed = true, tagline } = {}) => {
        const id = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active) VALUES (?, ?, 'professional', ?, 'ACCEPTED', 1)",
            [`${name.replace(/\W/g, '').toLowerCase()}-${stamp}@ai.example`, type === 'brand' ? 8 : 7, type]);
        await insert('INSERT INTO profiles (user_id, email, name) VALUES (?, ?, ?)', [id, `${name.replace(/\W/g, '').toLowerCase()}-${stamp}@ai.example`, name]);
        const slug = `${name.replace(/\W/g, '').toLowerCase()}${stamp}`;
        await insert("INSERT INTO business_cards (user_id, name, business_name, professional_title, status, slug, business_card_link) VALUES (?, ?, ?, ?, 'accepted', ?, ?)",
            [id, name, name, tagline ?? null, slug, `https://glamlink.net/access/${slug}`]);
        await insert('INSERT INTO profile_pages (user_id, is_listed) VALUES (?, ?)', [id, listed ? 1 : 0]);
        return id;
    };
    ids.pro = await account(`Bakuchiol Pro ${stamp}`, 'individual', { tagline: `${KEY} facials` });
    ids.unlisted = await account(`Hidden Pro ${stamp}`, 'individual', { listed: false, tagline: `${KEY} peels` });
    ids.brand = await account(`Kind Labs ${stamp}`, 'brand', { tagline: `${KEY} serums` });
    const product = (title, status = 'published') => insert('INSERT INTO shops (title, status, short_description) VALUES (?, ?, ?)', [`${title} ${stamp}`, status, title]);
    ids.serum = await product(`${KEY} serum`);
    ids.cream = await product(`${KEY} cream`);
    ids.mist = await product(`${KEY} mist`);
    ids.draftProduct = await product(`${KEY} prototype`, 'draft');
    ids.attached = await product(`${KEY} eye gel`);
    await insert('INSERT INTO journal_topic_product_mappings (topic_id, shop_id, sort_order) VALUES (?, ?, 1)', [topic, ids.attached]);
});
after(async () => {
    openai.responses.json = realJson;
    await app.close();
});

const start = (body = {}, topicId = topic) => app.request('POST', `/api/v1/journal/topic/${topicId}/ai-runs`, { body, headers: auth });
const run = (id) => app.request('GET', `/api/v1/journal/topic/${topic}/ai-runs/${id}`, { headers: auth });
// Starts a run and waits for it to finish: the run as GET answers it.
const finished = async (body) => {
    const res = await start(body);
    assert.equal(res.status, 202, res.body.message);
    await topicAi.inFlight.get(res.body.data.id);
    return (await run(res.body.data.id)).body.data;
};
const items = async () => (await app.request('GET', `/api/v1/journal/topic/${topic}/items`, { headers: auth })).body.data;
// The ids offered to the calls about one kind ("Choose the <label>").
const offeredIds = (label) => calls.filter((c) => c.instructions.includes(`Choose the ${label}`)).flatMap(offered).map((item) => item.id);

describe('starting a run', () => {
    test('needs the OpenAI key, an admin, a topic and options that make sense', async () => {
        const key = config.OPENAI_API_KEY;
        config.OPENAI_API_KEY = undefined;
        const off = await start();
        config.OPENAI_API_KEY = key;
        assert.deepEqual([off.status, off.body.code], [503, 'AI_NOT_CONFIGURED']);
        assert.equal((await app.request('POST', `/api/v1/journal/topic/${topic}/ai-runs`, { body: {} })).status, 401);
        assert.equal((await start({}, 99999999)).status, 404);
        const field = async (body) => (await start(body)).body.details?.field;
        assert.equal(await field({ types: ['podcast'] }), 'types');
        assert.equal(await field({ types: 7 }), 'types');
        assert.equal(await field({ mode: 'auto' }), 'mode');
        assert.equal(await field({ limits: { article: 0 } }), 'limits');
        assert.equal(await field({ min_score: 101 }), 'min_score');
        assert.equal(await field({ instructions: 'x'.repeat(1001) }), 'instructions');
        assert.equal(calls.length, 0, 'nothing was asked of OpenAI');
    });
});

describe('an apply run', () => {
    let done;
    before(async () => {
        const res = await start({ instructions: 'Prefer gentle options.', limits: { product: 2 } });
        assert.equal(res.status, 202, res.body.message);
        assert.deepEqual([res.body.data.status, res.body.data.mode, res.body.data.model, res.body.data.reasoning_effort, res.body.data.admin_id],
            ['running', 'apply', 'gpt-6-luna', 'medium', ids.admin]);
        assert.deepEqual(res.body.data.types, ['article', 'video', 'professional', 'brand', 'product']);
        await topicAi.inFlight.get(res.body.data.id);
        done = (await run(res.body.data.id)).body.data;
    });

    test('asks the model once per kind, with a strict schema, only about what the public sees and the topic lacks', async () => {
        assert.equal(done.status, 'done', done.error);
        assert.equal(calls.length, 5);
        const call = calls.find((c) => c.instructions.includes('Choose the shop products'));
        assert.deepEqual([call.model, call.effort, call.name, call.schema.properties.picks.items.required], ['gpt-6-luna', 'medium', 'topic_picks', ['id', 'score', 'reason']]);
        assert.match(call.instructions, /Pick at most 2,/);
        assert.match(call.input, new RegExp(`Topic: Gentle retinoids ${stamp}\\nDescription: Plant alternatives such as ${KEY}\\.\\nEditor's notes: Prefer gentle options\\.`));
        const articles = offeredIds('journal articles');
        assert.ok(articles.includes(ids.article) && !articles.includes(ids.draftArticle), 'published articles only');
        assert.ok(!offeredIds('videos').includes(ids.draftVideo));
        const pros = offeredIds('beauty professionals');
        assert.ok(pros.includes(ids.pro) && !pros.includes(ids.unlisted), 'pages that show only');
        const products = offeredIds('shop products');
        assert.ok(!products.includes(ids.attached) && !products.includes(ids.draftProduct), 'not what the topic has, not drafts');
        assert.deepEqual([done.input_tokens, done.output_tokens], [5000, 500]);
    });

    test('puts the picks on the topic with their reasons; low scores, the limit and unknown ids are left out', async () => {
        const outcome = Object.fromEntries(done.picks.map((p) => [`${p.type}:${p.id}`, p.outcome]));
        assert.equal(outcome[`article:${ids.article}`], 'added');
        assert.equal(outcome[`article:${ids.loose}`], 'low_score');
        assert.equal(outcome[`video:${ids.video}`], 'added');
        assert.equal(outcome[`professional:${ids.pro}`], 'added');
        assert.equal(outcome[`brand:${ids.brand}`], 'added');
        assert.deepEqual([ids.serum, ids.cream, ids.mist].map((id) => outcome[`product:${id}`]).toSorted(), ['added', 'added', 'over_limit']);
        assert.ok(!done.picks.some((p) => p.id === 99999999));
        assert.equal(done.added, 6);
        const pick = done.picks.find((p) => p.type === 'article' && p.id === ids.article);
        assert.deepEqual([pick.title, pick.score, pick.reason], [`All about ${KEY} ${stamp}`, 90, `It is about ${KEY}.`]);

        const list = await items();
        const article = list.items.article.find((a) => a.id === ids.article);
        assert.deepEqual([article.source, article.ai.score, article.ai.reason, article.ai.run_id], ['ai', 90, `It is about ${KEY}.`, done.id]);
        assert.equal(list.items.product.find((p) => p.id === ids.attached).source, 'admin');
        const page = (await app.request('GET', `/api/v1/journal/topic/${topic}`)).body.data;
        assert.ok(page.journals.some((j) => j.id === ids.article));
        assert.ok(page.videos.some((v) => v.id === ids.video));
        assert.deepEqual([page.professionals.map((p) => p.id), page.brands.map((b) => b.id)], [[ids.pro], [ids.brand]]);
    });

    test('what an admin takes off is never offered again; a later run adds only what is new', async () => {
        await app.request('DELETE', `/api/v1/journal/topic/${topic}/items/article/${ids.article}`, { headers: auth });
        const fresh = await insert("INSERT INTO journals (title, author_id, slug, status, content) VALUES (?, (SELECT id FROM authors WHERE name = 'AI Writer' LIMIT 1), ?, 'published', '<p>x</p>')",
            [`More on ${KEY} ${stamp}`, `more-on-${stamp}`]);
        calls.length = 0;
        const again = await finished({ types: ['article'] });
        assert.equal(again.status, 'done', again.error);
        const asked = offeredIds('journal articles');
        assert.ok(!asked.includes(ids.article), 'the one taken off');
        assert.deepEqual(again.picks.filter((p) => p.outcome === 'added').map((p) => p.id), [fresh]);
        assert.ok(!(await items()).items.article.some((a) => a.id === ids.article));
    });
});

describe('a suggest run', () => {
    test('leaves its picks for an admin: taking one counts as the AI\'s, dismissing one rejects it', async () => {
        const one = await insert("INSERT INTO shops (title, status) VALUES (?, 'published')", [`${KEY} toner ${stamp}`]);
        const two = await insert("INSERT INTO shops (title, status) VALUES (?, 'published')", [`${KEY} balm ${stamp}`]);
        const done = await finished({ mode: 'suggest', types: ['product'], limits: { product: 5 } });
        assert.equal(done.status, 'done', done.error);
        assert.ok(done.suggested >= 2);
        let list = await items();
        assert.deepEqual(list.suggestions.product.filter((p) => [one, two].includes(p.id)).map((p) => [p.source, p.ai.status, p.ai.score]), [['ai', 'suggested', 90], ['ai', 'suggested', 90]]);
        assert.ok(!list.items.product.some((p) => p.id === one), 'not on the topic yet');
        assert.ok(!(await app.request('GET', `/api/v1/journal/topic/${topic}`)).body.data.shops.some((s) => s.id === one));

        await app.request('POST', `/api/v1/journal/topic/${topic}/items`, { body: { type: 'product', id: one }, headers: auth });
        assert.equal((await app.request('DELETE', `/api/v1/journal/topic/${topic}/items/product/${two}`, { headers: auth })).status, 200);
        list = await items();
        const taken = list.items.product.find((p) => p.id === one);
        assert.deepEqual([taken.source, taken.ai.status], ['ai', 'added']);
        assert.ok(!list.suggestions.product.some((p) => p.id === two));
        const [memory] = await q("SELECT status FROM journal_topic_ai_items WHERE topic_id = ? AND item_type = 'product' AND item_id = ?", [topic, two]);
        assert.equal(memory.status, 'rejected');
    });
});

describe('runs', () => {
    test('one at a time per topic; a run cut short by a restart is closed', async () => {
        let release;
        let reached;
        const asked = new Promise((resolve) => { reached = resolve; });
        behave = (request) => new Promise((resolve) => {
            release = () => resolve(answer(request));
            reached();
        });
        // Products: some are still not on the topic, so the run asks the model and waits. Two clicks at once start one.
        const both = await Promise.all([start({ types: ['product'] }), start({ types: ['product'] })]);
        assert.deepEqual(both.map((r) => r.status).toSorted(), [202, 409]);
        const first = both.find((r) => r.status === 202);
        const second = await start({ types: ['product'] });
        assert.deepEqual([second.status, second.body.code, second.body.details], [409, 'AI_RUN_IN_PROGRESS', { run_id: first.body.data.id }]);
        await asked;
        release();
        await topicAi.inFlight.get(first.body.data.id);
        behave = null;

        const stale = await insert("INSERT INTO journal_topic_ai_runs (topic_id, status, types, model, started_at) VALUES (?, 'running', 'article', 'gpt-6-luna', NOW() - INTERVAL 40 MINUTE)", [topic]);
        const list = await app.request('GET', `/api/v1/journal/topic/${topic}/ai-runs`, { headers: auth });
        assert.equal(list.status, 200);
        const row = list.body.data.rows.find((r) => r.id === stale);
        assert.deepEqual([row.status, row.error], ['failed', 'Stopped: the server restarted during the run.']);
        assert.equal(row.picks, undefined, 'the list leaves the picks out');
        assert.deepEqual(list.body.data.rows.map((r) => r.id), list.body.data.rows.map((r) => r.id).toSorted((a, b) => b - a), 'newest first');
    });

    test('one kind failing leaves the others; every kind failing fails the run, with what went wrong', async () => {
        // Articles and products the topic does not have yet are left, so both kinds ask the model.
        behave = (request) => {
            if (request.instructions.includes('Choose the journal articles')) throw new openai.OpenAIError('unavailable', 'socket hang up');
            return answer(request);
        };
        const partial = await finished({ types: ['article', 'product'] });
        assert.equal(partial.status, 'done');
        assert.equal(partial.error, 'article: OpenAI did not answer. Try again in a moment.');
        behave = () => {
            throw new openai.OpenAIError('invalid', '401: Incorrect API key provided.');
        };
        await insert("INSERT INTO shops (title, status) VALUES (?, 'published')", [`Plain toner ${stamp}`]);
        const failed = await finished({ types: ['article', 'product'] });
        assert.equal(failed.status, 'failed');
        assert.match(failed.error, /^article: OpenAI refused the request: 401: Incorrect API key provided\. product: /);
        behave = null;
        assert.equal((await run(99999999)).status, 404);
    });

    test('a database error inside a run fails the run, not the server', async () => {
        const { JournalTopicAiRun } = require('../src/models');
        const findByPk = JournalTopicAiRun.findByPk;
        JournalTopicAiRun.findByPk = async () => { throw new Error('Connection lost'); };
        try {
            const res = await start({ types: ['article'] });
            assert.equal(res.status, 202);
            await topicAi.inFlight.get(res.body.data.id);
            JournalTopicAiRun.findByPk = findByPk;
            const failed = (await run(res.body.data.id)).body.data;
            assert.deepEqual([failed.status, failed.error], ['failed', 'The run failed.']);
        } finally {
            JournalTopicAiRun.findByPk = findByPk;
        }
    });
});

// One call of the real integration (its HTTP client faked below), and how it failed.
const ask = () => realJson({ model: 'gpt-6-luna', effort: 'low', instructions: 'Pick.', input: 'Items', schema: { type: 'object' }, name: 'topic_picks' });
const kind = async () => {
    try {
        await ask();
        return null;
    } catch (err) {
        return [err.name, err.kind];
    }
};

describe('the OpenAI call (integrations/openai.js)', () => {
    const realPost = httpClient.post;
    after(() => { httpClient.post = realPost; });
    const reply = (data) => { httpClient.post = async (url, body, options) => { reply.sent = { url, body, options }; return { data }; }; };
    const fail = (status, message) => {
        httpClient.post = async () => {
            throw Object.assign(new Error(status ? `Request failed with status code ${status}` : 'fetch failed'), status && { response: { status, data: { error: { message } } } });
        };
    };

    test('sends a strict JSON schema, keeps nothing at OpenAI, and reads the answer and the tokens', async () => {
        reply({
            status: 'completed',
            output: [{ type: 'reasoning', summary: [] }, { type: 'message', content: [{ type: 'output_text', text: '{"picks":[{"id":1,"score":80,"reason":"Fits."}]}' }] }],
            usage: { input_tokens: 120, output_tokens: 30 },
        });
        const { value, usage } = await ask();
        assert.deepEqual(value, { picks: [{ id: 1, score: 80, reason: 'Fits.' }] });
        assert.deepEqual(usage, { input_tokens: 120, output_tokens: 30 });
        const { url, body, options } = reply.sent;
        assert.equal(url, 'https://api.openai.com/v1/responses');
        assert.deepEqual([body.model, body.reasoning, body.store, body.text.format], ['gpt-6-luna', { effort: 'low' }, false, { type: 'json_schema', name: 'topic_picks', schema: { type: 'object' }, strict: true }]);
        assert.equal(options.headers.Authorization, `Bearer ${config.OPENAI_API_KEY}`);
    });

    test('a refusal, a cut-off answer, no answer and a refused request each say so', async () => {
        reply({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No.' }] }] });
        assert.deepEqual(await kind(), ['OpenAIError', 'refused']);
        reply({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] });
        assert.deepEqual(await kind(), ['OpenAIError', 'incomplete']);
        reply({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'not json' }] }] });
        assert.deepEqual(await kind(), ['OpenAIError', 'incomplete']);
        fail(429, 'Rate limit reached');
        assert.deepEqual(await kind(), ['OpenAIError', 'unavailable']);
        fail(null);
        assert.deepEqual(await kind(), ['OpenAIError', 'unavailable']);
        fail(400, 'Invalid schema');
        assert.deepEqual(await kind(), ['OpenAIError', 'invalid']);
    });
});
