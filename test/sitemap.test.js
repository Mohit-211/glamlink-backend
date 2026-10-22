// The sitemap feed (Phase 6, the website's requests): GET /sitemap answers every public page's id, slug and date of
// last change, by kind, each kind by its own rules for what is public (search/sitemap.service.js).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');

let app, q, insert, auth;
const stamp = `${Date.now()}`.slice(-8);
const ids = {};

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (8, 'Brand', 'BRND')");
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Sitemap Admin', ?, 1, 1)", [`sitemap-${stamp}@admin.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };

    const author = await insert("INSERT INTO authors (name) VALUES ('Sitemap Writer')");
    const article = (slug, { status = 'published', active = 1, deleted = null } = {}) => insert(
        "INSERT INTO journals (title, author_id, content, status, slug, is_active, deleted_at) VALUES (?, ?, '<p>x</p>', ?, ?, ?, ?)",
        [slug, author, status, slug, active, deleted],
    );
    ids.article = await article(`map-article-${stamp}`);
    await q("UPDATE journals SET updated_at = '2026-05-06 07:08:09' WHERE id = ?", [ids.article]);
    await article(`map-draft-${stamp}`, { status: 'draft' });
    await article(`map-off-${stamp}`, { active: 0 });
    await article(`map-gone-${stamp}`, { deleted: '2026-10-01 00:00:00' });

    ids.topic = await insert('INSERT INTO journal_topics (name, slug) VALUES (?, ?)', ['Map Topic', `map-topic-${stamp}`]);
    await insert('INSERT INTO journal_topics (name, slug, is_active) VALUES (?, ?, 0)', ['Off Topic', `map-off-topic-${stamp}`]);

    ids.product = await insert("INSERT INTO shops (title, slug, status) VALUES ('Map Balm', ?, 'published')", [`map-balm-${stamp}`]);
    await insert("INSERT INTO shops (title, slug, status) VALUES ('Draft Balm', ?, 'draft')", [`map-draft-balm-${stamp}`]);
    await insert("INSERT INTO shops (title, slug, status, is_active) VALUES ('Off Balm', ?, 'published', 0)", [`map-off-balm-${stamp}`]);

    ids.video = await insert("INSERT INTO videos (youtube_id, title, slug, status) VALUES (?, 'Map video', ?, 'published')", [`m${stamp}a`.slice(0, 11), `map-video-${stamp}`]);
    await insert("INSERT INTO videos (youtube_id, title, slug, status) VALUES (?, 'Draft video', ?, 'draft')", [`m${stamp}b`.slice(0, 11), `map-draft-video-${stamp}`]);
    ids.issue = await insert("INSERT INTO magazine_issues (title, slug, status) VALUES ('Map issue', ?, 'published')", [`map-issue-${stamp}`]);
    await insert("INSERT INTO magazine_issues (title, slug, status) VALUES ('Draft issue', ?, 'draft')", [`map-draft-issue-${stamp}`]);

    const brand = async (name) => {
        const res = await app.request('POST', '/api/v1/profiles/admin/brands', { body: { name, email: `${name.toLowerCase().replace(/\W+/g, '-')}@brand.example` }, headers: auth });
        assert.equal(res.status, 201, res.body.message);
        return res.body.data;
    };
    ids.brand = (await brand(`Map Brand ${stamp}`)).user_id;
    ids.hidden = (await brand(`Hidden Brand ${stamp}`)).user_id;
    await q('UPDATE profile_pages SET is_listed = 0 WHERE user_id = ?', [ids.hidden]);
    await q("UPDATE profile_pages SET updated_at = '2026-09-10 11:12:13' WHERE user_id = ?", [ids.brand]);
    await q("UPDATE profiles SET updated_at = '2026-01-01 00:00:00' WHERE user_id = ?", [ids.brand]);
});
after(() => app.close());

// A date as the database gives it (its time zone is the connection's).
const changed = async (sql, id) => (await q(sql, [id]))[0].updated_at.toISOString();

test('GET /sitemap lists every public page by kind, with its slug and date of last change', async () => {
    const res = await app.request('GET', '/api/v1/sitemap');
    assert.equal(res.status, 200, res.body.message);
    const map = res.body.data;
    assert.deepEqual(Object.keys(map), ['articles', 'topics', 'profiles', 'products', 'videos', 'issues']);
    const mine = (kind) => map[kind].filter((row) => String(row.slug).includes(stamp)).map((row) => row.slug);

    assert.deepEqual(mine('articles'), [`map-article-${stamp}`], 'not drafts, switched off or deleted ones');
    assert.deepEqual(mine('topics'), [`map-topic-${stamp}`]);
    assert.deepEqual(mine('products'), [`map-balm-${stamp}`]);
    assert.deepEqual(mine('videos'), [`map-video-${stamp}`]);
    assert.deepEqual(mine('issues'), [`map-issue-${stamp}`]);
    assert.deepEqual(mine('profiles'), [`map-brand-${stamp}`], 'not unlisted pages');

    const article = map.articles.find((row) => row.id === ids.article);
    assert.deepEqual(Object.keys(article), ['id', 'slug', 'updated_at']);
    assert.equal(article.updated_at, await changed('SELECT updated_at FROM journals WHERE id = ?', ids.article));
    const page = map.profiles.find((row) => row.id === ids.brand);
    assert.deepEqual(Object.keys(page), ['id', 'slug', 'type', 'updated_at']);
    assert.equal(page.type, 'brand');
    assert.equal(page.updated_at, await changed('SELECT updated_at FROM profile_pages WHERE user_id = ?', ids.brand), 'its latest change (the page)');
    assert.ok(map.topics.some((row) => row.id === ids.topic) && map.products.some((row) => row.id === ids.product));
    assert.ok(map.videos.some((row) => row.id === ids.video) && map.issues.some((row) => row.id === ids.issue));
});
