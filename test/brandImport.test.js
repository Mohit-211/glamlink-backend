// Brands in bulk from a CSV (Mohit, Nov 24): each row a brand page without a login, the email optional; a dry run
// checks the file and makes nothing; what is already here is skipped, so the same file imported twice adds nothing.
// A brand without an email shows its page; an admin adds the email before inviting it (website/profiles).
const { test, before, after, describe } = require('node:test');
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
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (7, 'Professional', 'PRO'), (8, 'Brand', 'BRND')");
    // A brand already here (its name), and an account already holding an email.
    ids.existing = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active) VALUES (?, 8, 'professional', 'brand', 'ACCEPTED', 1)",
        [`existing-${stamp}@brand.example`]);
    await insert('INSERT INTO profiles (user_id, email, name) VALUES (?, ?, ?)', [ids.existing, `existing-${stamp}@brand.example`, `Existing Glow ${stamp}`]);
    await insert('INSERT INTO profile_pages (user_id, created_by_admin) VALUES (?, 1)', [ids.existing]);
    ids.taken = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active) VALUES (?, 7, 'professional', 'individual', 'ACCEPTED', 1)",
        [`taken-${stamp}@pro.example`]);
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Import Admin', ?, 1, 1)", [`import-admin-${stamp}@test.example`]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
});
after(() => app.close());

const S = (name) => `${name} ${stamp}`;
const csv = (lines) => `${lines.join('\r\n')}\r\n`;
const HEADER = 'Name,Email,Website,Instagram,Category,Shipping,Tagline,About,Notes';
// Rows 2 to 10 as a spreadsheet numbers them (the About cell on row 2 holds line breaks), then empty rows it exported.
const FILE = csv([
    HEADER,
    `${S('Luma Skin')},hello-${stamp}@luma.example,luma.example,@lumaskin,Skincare Brand,Ships nationwide,Clean skincare,"Small batches.\n\nMade in Nevada.",first`,
    `${S('Nova Hair')},,nova.example,,haircare,local,,,no email`,
    `${S('Bad Link')},,not a link,,glitter,everywhere,,,warnings`,
    `${S('Existing Glow')},,,,,,,,already a brand`,
    `${S('Taken Mail')},taken-${stamp}@pro.example,,,,,,,email has an account`,
    ',nobody@nowhere.example,,,,,,,no name',
    `${S('Bad Mail')},not-an-email,,,,,,,`,
    `${S('Luma Skin')},,,,,,,,again in the file`,
    `${S('Long Tag')},,,,,,${'x'.repeat(151)},,tagline too long`,
    ',,,,,,,,',
    '',
]);
const send = (body) => app.request('POST', '/api/v1/profiles/admin/brands/import', { body, headers: auth });
// Each name's first row.
const byName = (rows) => Object.fromEntries(rows.filter((r) => r.name).toReversed().map((r) => [r.name, r]));

describe('the template', () => {
    test('lists every column with an example brand; admins only', async () => {
        const res = await app.request('GET', '/api/v1/profiles/admin/brands/import/template', { headers: auth });
        assert.equal(res.status, 200);
        assert.match(res.headers.get('content-type'), /text\/csv/);
        assert.match(res.headers.get('content-disposition'), /^attachment; filename="?glamlink-brands-template.csv"?$/);
        const [header, example] = res.body.split('\r\n');
        assert.equal(header, '"name","email","website","instagram","tiktok","facebook","youtube","linkedin","category","shipping","tagline","intro","about","slug","listed","featured","image","cover_image"');
        assert.match(example, /^"Glow Botanics","hello@glowbotanics.example"/);
        assert.equal((await app.request('GET', '/api/v1/profiles/admin/brands/import/template')).status, 401);
    });
});

describe('importing', () => {
    test('a dry run checks every row and makes nothing', async () => {
        const res = await send({ csv: FILE, dry_run: true });
        assert.equal(res.status, 200, res.body.message);
        const data = res.body.data;
        assert.deepEqual([data.dry_run, data.total, data.created, data.ready, data.skipped, data.failed], [true, 9, 0, 3, 2, 4]);
        assert.deepEqual(data.ignored_columns, ['Notes']);
        const rows = byName(data.rows);
        assert.deepEqual([rows[S('Luma Skin')].row, rows[S('Luma Skin')].status, rows[S('Luma Skin')].slug], [2, 'ready', `luma-skin-${stamp}`]);
        assert.deepEqual([rows[S('Existing Glow')].status, rows[S('Existing Glow')].code, rows[S('Existing Glow')].user_id], ['skipped', 'BRAND_EXISTS', ids.existing]);
        assert.deepEqual([rows[S('Taken Mail')].status, rows[S('Taken Mail')].code, rows[S('Taken Mail')].user_id], ['skipped', 'ACCOUNT_EXISTS', ids.taken]);
        assert.deepEqual([rows[S('Bad Mail')].status, rows[S('Bad Mail')].field], ['failed', 'email']);
        assert.deepEqual([rows[S('Long Tag')].status, rows[S('Long Tag')].field], ['failed', 'tagline']);
        const noName = data.rows.find((r) => r.row === 7);
        assert.deepEqual([noName.status, noName.code, noName.field], ['failed', 'INVALID_PAGE', 'name']);
        const again = data.rows.find((r) => r.row === 9);
        assert.deepEqual([again.status, again.code, again.message], ['failed', 'DUPLICATE_IN_FILE', 'Row 2 has this name already.']);
        assert.equal(rows[S('Bad Link')].status, 'ready');
        assert.equal(rows[S('Bad Link')].warnings.length, 3, 'website, category and shipping are left out');
        assert.ok(rows[S('Bad Link')].warnings.some((w) => w.startsWith('website:')));
        assert.equal((await q('SELECT COUNT(*) AS n FROM users WHERE email = ?', [`hello-${stamp}@luma.example`]))[0].n, 0, 'nothing made');
    });

    test('the import makes brand pages without logins, from a file Excel on Windows sends; the same file again adds nothing', async () => {
        const upload = () => app.form('POST', '/api/v1/profiles/admin/brands/import', {
            files: { csv_file: [{ name: 'brands.csv', type: 'application/vnd.ms-excel', data: Buffer.from(FILE) }] },
            headers: auth,
        });
        const res = await upload();
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual([res.body.data.created, res.body.data.skipped, res.body.data.failed], [3, 2, 4]);
        const rows = byName(res.body.data.rows);
        ids.luma = rows[S('Luma Skin')].user_id;
        ids.nova = rows[S('Nova Hair')].user_id;
        const [luma] = await q('SELECT email, password, account_type, professional_type, role_id FROM users WHERE id = ?', [ids.luma]);
        assert.deepEqual(luma, { email: `hello-${stamp}@luma.example`, password: null, account_type: 'professional', professional_type: 'brand', role_id: 8 });
        const [nova] = await q('SELECT email, password FROM users WHERE id = ?', [ids.nova]);
        assert.deepEqual(nova, { email: null, password: null }, 'no email at all, not an empty one');
        const [page] = await q('SELECT slug, created_by_admin, category, shipping, website, social, about, is_listed FROM profile_pages WHERE user_id = ?', [ids.luma]);
        assert.deepEqual([page.slug, page.created_by_admin, page.category, page.shipping, page.website, page.is_listed], [`luma-skin-${stamp}`, 1, 'skincare', 'nationwide', 'https://luma.example', 1]);
        assert.deepEqual(JSON.parse(page.social), [{ title: 'Instagram', url: 'https://www.instagram.com/lumaskin' }]);
        assert.equal(page.about, '<p>Small batches.</p><p>Made in Nevada.</p>');

        const shown = await app.request('GET', `/api/v1/profiles/luma-skin-${stamp}`);
        assert.equal(shown.status, 200, 'an admin-made brand page shows without a card');
        assert.deepEqual([shown.body.data.name, shown.body.data.type, shown.body.data.category_label], [S('Luma Skin'), 'brand', 'Skincare Brand']);
        assert.equal((await app.request('GET', `/api/v1/profiles/nova-hair-${stamp}`)).status, 200, 'without an email too');

        const twice = await upload();
        assert.deepEqual([twice.body.data.created, twice.body.data.skipped, twice.body.data.failed], [0, 6, 3]);
        assert.equal(byName(twice.body.data.rows)[S('Nova Hair')].code, 'BRAND_EXISTS', 'a brand with no email is found by its name');
        assert.equal((await q('SELECT COUNT(*) AS n FROM users WHERE email = ?', [`hello-${stamp}@luma.example`]))[0].n, 1);
    });

    test('a semicolon file in Windows-1252 reads right; slugs stay free within the file', async () => {
        const latin = Buffer.from(`name;email\r\nCrème ${stamp};\r\nCreme ${stamp}!;\r\n`, 'latin1');
        const res = await app.form('POST', '/api/v1/profiles/admin/brands/import', {
            fields: { dry_run: 'true' },
            files: { csv_file: [{ name: 'brands.csv', type: 'text/csv', data: latin }] },
            headers: auth,
        });
        assert.equal(res.status, 200, res.body.message);
        const [creme, again] = res.body.data.rows;
        assert.deepEqual([creme.name, creme.status, creme.slug], [`Crème ${stamp}`, 'ready', `creme-${stamp}`]);
        // The same name but for an accent and punctuation is the same brand.
        assert.deepEqual([again.status, again.code], ['failed', 'DUPLICATE_IN_FILE']);
    });

    test('refusals: a file without a name column, without rows, or too long; admins only', async () => {
        const refusal = async (body) => {
            const res = await send(body);
            return [res.status, res.body.code];
        };
        assert.deepEqual(await refusal({ csv: 'brand_owner,email\r\nx,y\r\n' }), [400, 'INVALID_CSV']);
        assert.deepEqual(await refusal({ csv: 'name,email\r\n' }), [400, 'INVALID_CSV']);
        assert.deepEqual(await refusal({ csv: '' }), [400, 'INVALID_CSV']);
        assert.deepEqual(await refusal({ csv: `name\r\n${Array.from({ length: 501 }, (_, i) => `B${i}`).join('\r\n')}` }), [400, 'INVALID_CSV']);
        assert.deepEqual(await refusal({ csv: 'name,email\r\n"open quote,x\r\n' }), [400, 'INVALID_CSV']);
        const extra = await send({ csv: `name,email\r\n${S('Comma')}, Inc,x@y.example\r\n`, dry_run: true });
        assert.deepEqual([extra.body.data.rows[0].status, extra.body.data.rows[0].code], ['failed', 'INVALID_CSV'], 'an unquoted comma shifts the row');
        assert.equal((await app.request('POST', '/api/v1/profiles/admin/brands/import', { body: { csv: FILE } })).status, 401);
    });
});

const page = (id) => app.request('GET', `/api/v1/profiles/admin/${id}`, { headers: auth });
const save = (id, body) => app.request('PUT', `/api/v1/profiles/admin/${id}`, { body, headers: auth });
const invite = (id) => app.request('POST', `/api/v1/profiles/admin/${id}/invite`, { headers: auth });

describe('a brand without an email', () => {

    test('can be made one at a time too, and shows on the admin list without an email', async () => {
        const res = await app.request('POST', '/api/v1/profiles/admin/brands', { body: { name: S('Solo Brand') }, headers: auth });
        assert.equal(res.status, 201, res.body.message);
        assert.deepEqual([res.body.data.email, res.body.data.claimed], [null, false]);
        ids.solo = res.body.data.user_id;
        const list = await app.request('GET', `/api/v1/profiles/admin/list?type=brand&search=${encodeURIComponent(S('Solo Brand'))}`, { headers: auth });
        assert.deepEqual(list.body.data.rows.map((r) => [r.id, r.email]), [[ids.solo, null]]);
    });

    test('waits for an email to be invited; an admin adds one (not one in use), and old links stop working when it changes', async () => {
        assert.deepEqual((await page(ids.nova)).body.data.email, null);
        const refused = await invite(ids.nova);
        assert.deepEqual([refused.status, refused.body.code], [409, 'NO_EMAIL']);
        const taken = await save(ids.nova, { email: `taken-${stamp}@pro.example` });
        assert.deepEqual([taken.status, taken.body.code], [409, 'ACCOUNT_EXISTS']);
        const bad = await save(ids.nova, { email: 'nope' });
        assert.deepEqual([bad.status, bad.body.details], [400, { field: 'email' }]);

        const added = await save(ids.nova, { email: `Nova-${stamp}@Hair.example`, tagline: 'Hair rituals' });
        assert.equal(added.status, 200, added.body.message);
        assert.deepEqual([added.body.data.email, added.body.data.page.tagline], [`nova-${stamp}@hair.example`, 'Hair rituals']);
        const [profile] = await q('SELECT email FROM profiles WHERE user_id = ?', [ids.nova]);
        assert.equal(profile.email, `nova-${stamp}@hair.example`);

        const sent = app.outbox.length;
        const invited = await invite(ids.nova);
        assert.equal(invited.status, 200, invited.body.message);
        assert.ok(app.outbox.slice(sent).some((mail) => mail.to === `nova-${stamp}@hair.example`));
        const [link] = await q("SELECT COUNT(*) AS n FROM email_tokens WHERE user_id = ? AND used_at IS NULL", [ids.nova]);
        assert.equal(link.n, 1);
        // A typo fixed after the invite: the link sent to the old address no longer works.
        assert.equal((await save(ids.nova, { email: `nova2-${stamp}@hair.example` })).status, 200);
        const [left] = await q("SELECT COUNT(*) AS n FROM email_tokens WHERE user_id = ? AND used_at IS NULL", [ids.nova]);
        assert.equal(left.n, 0);
    });

    test('once someone has signed in, the email is the owner\'s to change; so is any account an admin did not make as a brand page, or one with a card', async () => {
        await q("UPDATE users SET password = 'x' WHERE id = ?", [ids.solo]);
        const res = await save(ids.solo, { email: `solo-${stamp}@brand.example` });
        assert.deepEqual([res.status, res.body.code], [409, 'ALREADY_CLAIMED']);
        assert.equal((await save(ids.solo, { tagline: 'Still editable' })).status, 200, 'the rest of the page still saves');
        // A professional's account with no password (a card buyer who never set one, say): not the admin's to change.
        const pro = await save(ids.taken, { email: `elsewhere-${stamp}@pro.example` });
        assert.deepEqual([pro.status, pro.body.code], [409, 'EMAIL_NOT_EDITABLE']);
        // An admin-made brand page that has an Access card since: its payments go by its email.
        await insert("INSERT INTO business_cards (user_id, name, status, slug, business_card_link) VALUES (?, 'Luma', 'accepted', ?, ?)",
            [ids.luma, `lumacard${stamp}`, `https://glamlink.net/access/lumacard${stamp}`]);
        const carded = await save(ids.luma, { email: `luma2-${stamp}@luma.example` });
        assert.deepEqual([carded.status, carded.body.code], [409, 'EMAIL_NOT_EDITABLE']);
    });

    test('names in any script are told apart; user names stay unique for brands with no email', async () => {
        const res = await send({ csv: `name\r\n資生堂 ${stamp}\r\nロート製薬 ${stamp}\r\n!!!\r\nTwin Co ${stamp}\r\nTwinCo ${stamp}\r\n` });
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual(res.body.data.rows.map((r) => r.status), ['created', 'created', 'created', 'created', 'created']);
        const twins = res.body.data.rows.slice(3).map((r) => r.user_id);
        const names = await q('SELECT user_name FROM users WHERE id IN (?, ?)', twins);
        assert.equal(new Set(names.map((n) => n.user_name)).size, 2);
        const again = await send({ csv: `name\r\n資生堂 ${stamp}\r\n`, dry_run: true });
        assert.equal(again.body.data.rows[0].code, 'BRAND_EXISTS');
    });

    test('can be a product\'s brand, featured in an article and on a topic, like any brand', async () => {
        const product = await insert("INSERT INTO shops (title, status) VALUES (?, 'published')", [S('Nova Oil')]);
        const res = await app.request('PUT', `/api/v1/discover/shop/${product}`, { body: { brand_id: ids.solo }, headers: auth });
        assert.equal(res.status, 200, res.body.message);
        assert.equal((await q('SELECT brand_id FROM shops WHERE id = ?', [product]))[0].brand_id, ids.solo);
        // Made without an email (the account's email is NULL): still found as a brand account.
        const bare = (await send({ csv: `name\r\n${S('Bare Brand')}\r\n` })).body.data.rows[0].user_id;
        assert.equal((await app.request('PUT', `/api/v1/discover/shop/${product}`, { body: { brand_id: bare }, headers: auth })).status, 200);
        const topic = await insert('INSERT INTO journal_topics (name, slug) VALUES (?, ?)', [S('Oils'), `oils-${stamp}`]);
        const onTopic = await app.request('PUT', `/api/v1/journal/topic/${topic}/brands`, { body: { brand_ids: [bare] }, headers: auth });
        assert.equal(onTopic.status, 200, onTopic.body.message);
        assert.deepEqual(onTopic.body.data.brands.map((b) => b.id), [bare]);
    });
});
