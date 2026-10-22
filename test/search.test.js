// The site-wide search (Phase 6): GET /search answers every group (topics, professionals, brands, products, articles,
// videos) with exact matches first, then prefixes, then the rest; `type` pages one group; searches are counted for
// admins (website/search, migration 20261023-1200).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');

let app, q, insert, auth;
const stamp = `${Date.now()}`.slice(-8);
const word = `glowtox${stamp}`;
const Word = `Glowtox${stamp}`;

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (7, 'Professional', 'PRO'), (8, 'Brand', 'BRND')");

    await insert('INSERT INTO journal_topics (name, slug) VALUES (?, ?)', [Word, `${word}-topic`]);
    for (const title of [`Best ${Word} Kit`, Word, `${Word} Serum`]) await insert("INSERT INTO shops (title, status) VALUES (?, 'published')", [title]);
    const author = await insert("INSERT INTO authors (name) VALUES ('Search Author')");
    for (const title of [`Why ${Word} works`, `${Word} 101`]) {
        await insert("INSERT INTO journals (title, author_id, content, status, publish_date) VALUES (?, ?, '<p>x</p>', 'published', NOW())", [title, author]);
    }
    const account = async (name, type, handle) => {
        const id = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active) VALUES (?, ?, 'professional', ?, 'ACCEPTED', 1)",
            [`${handle}@search.example`, type === 'brand' ? 8 : 7, type]);
        await insert('INSERT INTO profiles (user_id, email, name) VALUES (?, ?, ?)', [id, `${handle}@search.example`, name]);
        await insert("INSERT INTO business_cards (user_id, name, business_name, status, slug, business_card_link) VALUES (?, ?, ?, 'accepted', ?, ?)", [id, name, name, handle, `https://glamlink.net/access/${handle}`]);
    };
    await account(`Dr ${Word}`, 'individual', `drglowtox${stamp}`);
    await account(Word, 'individual', `glowtoxpro${stamp}`);
    await account(`${Word} Labs`, 'brand', `glowtoxlabs${stamp}`);
    await insert("INSERT INTO videos (youtube_id, title, slug, status) VALUES (?, ?, ?, 'published')", [`s${stamp}xx`.slice(0, 11), `${Word} explained`, `${word}-explained`]);

    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Search Admin', ?, 1, 1)", [`search-admin-${stamp}@test.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
});
after(() => app.close());

const search = (query) => app.request('GET', `/api/v1/search?${query}`);

describe('GET /search', () => {
    test('answers every group, exact matches first, then those starting with the search', async () => {
        const res = await search(`q=${word.toUpperCase()}`);
        assert.equal(res.status, 200, res.body.message);
        const g = res.body.data;
        assert.deepEqual(Object.keys(g), ['topics', 'professionals', 'brands', 'products', 'articles', 'videos']);
        assert.deepEqual(g.topics.rows.map((r) => r.name), [Word]);
        assert.deepEqual(g.professionals.rows.map((r) => r.name), [Word, `Dr ${Word}`]);
        assert.deepEqual(g.brands.rows.map((r) => r.name), [`${Word} Labs`]);
        assert.deepEqual(g.products.rows.map((r) => r.title), [Word, `${Word} Serum`, `Best ${Word} Kit`]);
        assert.deepEqual(g.articles.rows.map((r) => r.title), [`${Word} 101`, `Why ${Word} works`]);
        assert.deepEqual(g.videos.rows.map((r) => r.title), [`${Word} explained`]);
        assert.equal(g.products.count, 3);
        assert.equal(g.articles.rows[0].content, undefined, 'light rows');
    });

    test('limit caps each group; type pages one group', async () => {
        const res = await search(`q=${word}&limit=1`);
        assert.deepEqual([res.body.data.products.rows.length, res.body.data.products.count], [1, 3]);
        const second = await search(`q=${word}&type=products&page=2&limit=1`);
        assert.deepEqual(second.body.data.rows.map((r) => r.title), [`${Word} Serum`]);
        assert.equal(second.body.data.count, 3);
    });

    test('a search is at least 2 characters; type is one of the groups', async () => {
        const short = await search('q=a');
        assert.deepEqual([short.status, short.body.code, short.body.details], [400, 'INVALID_SEARCH', { field: 'q' }]);
        assert.deepEqual((await search(`q=${word}&type=people`)).body.details, { field: 'type' });
    });
});

describe('admins', () => {
    test('see the most searched terms and the ones that found nothing', async () => {
        await search(`q=nothing${stamp}`);
        const top = await app.request('GET', '/api/v1/search/admin/terms?limit=500', { headers: auth });
        assert.equal(top.status, 200);
        const mine = top.body.data.find((t) => t.term === word);
        assert.ok(mine.searches >= 2, 'counted');
        assert.ok(mine.last_results > 0);
        const empty = await app.request('GET', '/api/v1/search/admin/terms?sort=empty', { headers: auth });
        assert.ok(empty.body.data.some((t) => t.term === `nothing${stamp}` && t.last_results === 0));
        assert.equal((await app.request('GET', '/api/v1/search/admin/terms')).status, 401);
    });
});
