// A card is found by its handle whatever host its link names (migration 20261023-0600): with WEBSITE_URL on the test
// site, existing cards (whose links name glamlink.net) still open, and a new card never takes an existing handle.
const fs = require('fs');
const path = require('path');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');
const { cardFields, cardFiles } = require('./cardFixtures');
const config = require('../src/core/config/config');
const { UPLOADS_DIR } = require('../src/core/config/paths');

let app, q;
const host = config.WEBSITE_URL;
const stamp = Date.now();

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
});
after(async () => {
    config.WEBSITE_URL = host;
    await app.close();
});

const guestCard = async (fields) => {
    const res = await app.form('POST', '/api/v1/businessCard', { fields: cardFields(fields), files: cardFiles() });
    assert.equal(res.status, 201, res.body.message);
    return res.body.data;
};

test('cards keep their handle in its own column, and open whatever host WEBSITE_URL names', async () => {
    const name = `Slug Person ${stamp}`;
    const card = await guestCard({ name, email: `slug-${stamp}@test.example` });
    const [row] = await q('SELECT slug, business_card_link FROM business_cards WHERE id = ?', [card.business_card_id]);
    assert.equal(row.slug, `slugperson${stamp}`);
    assert.equal(row.business_card_link, `${host}/access/${row.slug}`);
    await q("UPDATE business_cards SET status = 'accepted' WHERE id = ?", [card.business_card_id]);

    config.WEBSITE_URL = 'https://test.glamlink.example';
    const opened = await app.request('GET', `/api/v1/businessCard/getBusinessCard/${row.slug}`);
    assert.equal(opened.status, 200, 'a card made under glamlink.net opens on the test site');
    assert.equal(opened.body.data.id, card.business_card_id);

    const twin = await guestCard({ name, email: `slug-twin-${stamp}@test.example` });
    const [twinRow] = await q('SELECT slug, business_card_link FROM business_cards WHERE id = ?', [twin.business_card_id]);
    assert.equal(twinRow.slug, `slugperson${stamp}-1`, 'the existing handle stays taken');
    assert.equal(twinRow.business_card_link, `https://test.glamlink.example/access/slugperson${stamp}-1`);
});

test('the migration fills in handles from the links', async () => {
    const migration = require('../src/core/db/migrations/20261023-0600-card-slugs');
    const [{ id }] = await q('SELECT id FROM business_cards WHERE slug IS NOT NULL ORDER BY id DESC LIMIT 1');
    await q('UPDATE business_cards SET slug = NULL WHERE id = ?', [id]);
    const logs = [];
    await migration.up({ sequelize: app.sequelize, log: (line) => logs.push(line) });
    const [row] = await q('SELECT slug, business_card_link FROM business_cards WHERE id = ?', [id]);
    assert.equal(row.slug, row.business_card_link.split('/access/')[1]);
    assert.ok(logs.some((line) => /card handles filled in: [1-9]/.test(line)));
});

test('cards made on the test site move to WEBSITE_URL with new QR codes (npm run cards:relink)', async () => {
    const { relinkCards } = require('../src/website/access-card/cardWriter');
    config.WEBSITE_URL = 'https://test.glamlink.example';
    const card = await guestCard({ name: `Relink Person ${stamp}`, email: `relink-${stamp}@test.example` });
    const [made] = await q('SELECT slug, business_card_link FROM business_cards WHERE id = ?', [card.business_card_id]);
    assert.equal(made.business_card_link, `https://test.glamlink.example/access/${made.slug}`);
    config.WEBSITE_URL = host;

    const listed = (await relinkCards()).find((c) => c.id === card.business_card_id);
    assert.deepEqual([listed.from, listed.to], [made.business_card_link, `${host}/access/${made.slug}`]);
    const [untouched] = await q('SELECT business_card_link FROM business_cards WHERE id = ?', [card.business_card_id]);
    assert.equal(untouched.business_card_link, made.business_card_link, 'without apply it only lists');

    const qr = path.join(UPLOADS_DIR, 'images', 'qr', `${made.slug}.png`);
    const drawnBefore = Date.now() - 1000;
    await relinkCards({ apply: true });
    const [moved] = await q('SELECT slug, business_card_link FROM business_cards WHERE id = ?', [card.business_card_id]);
    assert.deepEqual([moved.slug, moved.business_card_link], [made.slug, `${host}/access/${made.slug}`]);
    assert.ok(fs.statSync(qr).mtimeMs >= drawnBefore, 'the QR code is drawn again');
    assert.ok(!(await relinkCards()).some((c) => c.id === card.business_card_id));
});
