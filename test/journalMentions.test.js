// Who an article features (Phase 6): @handles in an article are indexed on save and matched to accounts when read
// (page slug or card handle), so pages list the articles that mention them; editors add accounts and set mentions
// aside (website/content mentions; migration 20261023-0900).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const { handlesIn } = require('../src/website/content/mentionText');

let app, q, insert, auth, authorId, articleId;
const ids = {}; // accounts
const stamp = `${Date.now()}`.slice(-8);
const h = { niki: `niki${stamp}`, brand: `brandx${stamp}`, late: `latejoiner${stamp}`, nobody: `nobody${stamp}` };
const nikiPage = `niki-capobianco-${stamp}`;

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (7, 'Professional', 'PRO'), (8, 'Brand', 'BRND')");
    const account = async (name, type, handle) => {
        const id = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active) VALUES (?, ?, 'professional', ?, 'ACCEPTED', 1)",
            [`${handle}@mentions.example`, type === 'brand' ? 8 : 7, type]);
        await insert('INSERT INTO profiles (user_id, email, name) VALUES (?, ?, ?)', [id, `${handle}@mentions.example`, name]);
        return id;
    };
    ids.niki = await account('Niki', 'individual', h.niki);
    ids.brand = await account('Brand X', 'brand', h.brand);
    ids.late = await account('Late Joiner', 'individual', h.late);
    ids.other = await account('Other Brand', 'brand', `otherbrand${stamp}`);
    for (const [id, handle, name] of [[ids.niki, h.niki, 'Niki'], [ids.brand, h.brand, 'Brand X'], [ids.other, `otherbrand${stamp}`, 'Other Brand']]) {
        await insert("INSERT INTO business_cards (user_id, name, business_name, status, slug, business_card_link) VALUES (?, ?, ?, 'accepted', ?, ?)", [id, name, name, handle, `https://glamlink.net/access/${handle}`]);
    }
    await insert('INSERT INTO profile_pages (user_id, slug) VALUES (?, ?)', [ids.niki, nikiPage]);
    authorId = await insert("INSERT INTO authors (name) VALUES ('Editor')");
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM')");
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Mentions Admin', ?, 1, 1)", [`mentions-admin-${stamp}@test.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
});
after(() => app.close());

const article = (content, extra = {}) => ({ title: `Mentions ${stamp}`, author_id: authorId, content, status: 'published', publish_date: '2026-10-01', ...extra });
const CONTENT = `<p>Featuring @${h.niki} and @${h.brand}. Write to hello@site.example.</p><p>A typo: @${h.nobody}.</p>`
    + `<pre>@hidden${stamp}</pre><p>(@${h.late})</p>`;
const pageJournal = async (slug) => (await app.request('GET', `/api/v1/profiles/${slug}`)).body.data.journal;
const articleMentions = async () => (await app.request('GET', `/api/v1/journal/findJournalById/${articleId}`)).body.data.mentions;

describe('handles in the text', () => {
    test('only @handles in text: not emails, not code; trailing punctuation off', () => {
        assert.deepEqual(handlesIn(CONTENT), [h.niki, h.brand, h.nobody, h.late]);
        assert.deepEqual(handlesIn('<p>@Kate.Sue. and @kate.sue</p><p>@a</p>'), ['kate.sue']);
    });
});

describe('saving an article', () => {
    test('indexes its mentions and tells the editor which handles match no one', async () => {
        const res = await app.request('POST', '/api/v1/journal', { body: article(CONTENT), headers: auth });
        assert.equal(res.status, 201, res.body.message);
        articleId = res.body.data.id;
        assert.deepEqual(res.body.data.unmatched_mentions, [h.nobody, h.late]);
    });

    test('the article links the people it features to their pages', async () => {
        assert.deepEqual(await articleMentions(), [
            { handle: h.niki, slug: nikiPage, name: 'Niki', type: 'individual' },
            { handle: h.brand, slug: h.brand, name: 'Brand X', type: 'brand' },
        ]);
    });

    test('pages list the articles that mention them, by card handle or page slug', async () => {
        const journal = await pageJournal(nikiPage);
        assert.equal(journal.count, 1);
        assert.equal(journal.rows[0].id, articleId);
        assert.equal(journal.rows[0].content, undefined, 'article cards, no body');
        const all = await app.request('GET', `/api/v1/profiles/${h.brand}/articles?limit=5`);
        assert.equal(all.status, 200);
        assert.deepEqual(all.body.data.rows.map((r) => r.id), [articleId]);
    });

    test('someone who gets a card after the article is found then', async () => {
        await insert("INSERT INTO business_cards (user_id, name, status, slug, business_card_link) VALUES (?, 'Late Joiner', 'accepted', ?, ?)", [ids.late, h.late, `https://glamlink.net/access/${h.late}`]);
        assert.equal((await pageJournal(h.late)).count, 1);
        assert.ok((await articleMentions()).some((m) => m.handle === h.late));
    });
});

const mentionsUrl = () => `/api/v1/journal/${articleId}/mentions`;

describe('editors', () => {

    test('see each mention with its account, and the handles that match no one', async () => {
        const res = await app.request('GET', mentionsUrl(), { headers: auth });
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual(res.body.data.unmatched, [h.nobody]);
        const niki = res.body.data.mentions.find((m) => m.handle === h.niki);
        assert.deepEqual(niki.account, { id: ids.niki, slug: nikiPage, name: 'Niki', type: 'individual', visible: true });
        assert.equal((await app.request('GET', mentionsUrl())).status, 401);
    });

    test('set a mention aside, and it stays aside when the article is saved again', async () => {
        const { mentions } = (await app.request('GET', mentionsUrl(), { headers: auth })).body.data;
        const niki = mentions.find((m) => m.handle === h.niki);
        const removed = await app.request('DELETE', `${mentionsUrl()}/${niki.id}`, { headers: auth });
        assert.equal(removed.body.data.mentions.find((m) => m.id === niki.id).excluded, true);
        assert.equal((await pageJournal(nikiPage)).count, 0);
        assert.ok(!(await articleMentions()).some((m) => m.handle === h.niki));

        const saved = await app.request('PUT', `/api/v1/journal/${articleId}`, { body: { content: `${CONTENT}<p>More.</p>` }, headers: auth });
        assert.equal(saved.status, 200, saved.body.message);
        assert.equal((await pageJournal(nikiPage)).count, 0, 'still aside');
        const back = await app.request('PUT', `${mentionsUrl()}/${niki.id}`, { body: { excluded: false }, headers: auth });
        assert.equal(back.status, 200);
        assert.equal((await pageJournal(nikiPage)).count, 1);
    });

    test('add an account the article never @mentions, and remove it', async () => {
        const added = await app.request('POST', mentionsUrl(), { body: { user_id: ids.other }, headers: auth });
        assert.equal(added.status, 200, added.body.message);
        assert.equal((await pageJournal(`otherbrand${stamp}`)).count, 1);
        assert.ok((await articleMentions()).some((m) => m.handle === null && m.slug === `otherbrand${stamp}`));
        const editorMention = added.body.data.mentions.find((m) => m.source === 'editor');
        await app.request('DELETE', `${mentionsUrl()}/${editorMention.id}`, { headers: auth });
        assert.equal((await pageJournal(`otherbrand${stamp}`)).count, 0);
        assert.equal((await app.request('POST', mentionsUrl(), { body: { user_id: 99999999 }, headers: auth })).body.code, 'INVALID_MENTION');
    });

    test('a handle taken out of the text is no longer a mention; a draft is listed on no page', async () => {
        await app.request('PUT', `/api/v1/journal/${articleId}`, { body: { content: `<p>Only @${h.niki} now.</p>` }, headers: auth });
        assert.equal((await pageJournal(h.brand)).count, 0);
        await app.request('PUT', `/api/v1/journal/${articleId}`, { body: { status: 'draft' }, headers: auth });
        assert.equal((await pageJournal(nikiPage)).count, 0);
    });
});

describe('the migration', () => {
    test('indexes the articles already written', async () => {
        const migration = require('../src/core/db/migrations/20261023-0900-journal-mentions');
        await migration.down({ sequelize: app.sequelize });
        const old = await insert("INSERT INTO journals (title, author_id, content, status) VALUES ('Old one', ?, ?, 'published')", [authorId, `<p>Hello @${h.brand}</p>`]);
        const logs = [];
        await migration.up({ sequelize: app.sequelize, log: (line) => logs.push(line) });
        const rows = await q("SELECT handle FROM journal_mentions WHERE journal_id = ? AND source = 'text'", [old]);
        assert.deepEqual(rows.map((r) => r.handle), [h.brand]);
        assert.ok(logs.some((line) => line.includes('article mentions indexed')));
    });
});
