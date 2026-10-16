// Stored links to the old backend move to API_BASE_URL (migration 20261016-0800); recorded history keeps its own.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');
const { cardFields, cardFiles } = require('./cardFixtures');
const config = require('../src/core/config/config');
const migration = require('../src/core/db/migrations/20261016-0800-file-urls-on-api-host');

let app, q;
before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
});
after(() => app.close());

const text = (value) => (typeof value === 'string' ? value : JSON.stringify(value));

test('card photos and featured links move to the API host, analytics keep theirs, down puts them back', async () => {
    const base = config.API_BASE_URL.replace(/\/+$/, '');
    const draft = (await app.form('POST', '/api/v1/businessCard', { fields: cardFields(), files: cardFiles() })).body.data;
    const id = draft.business_card_id;
    const photo = 'https://node.glamlink.net:5000/images/me.png';
    const links = JSON.stringify([{ title: 'Menu', url: 'https://example.com/menu', image: 'https://node.glamlink.net/images/menu.png' }]);
    await q("UPDATE business_cards SET profile_image = ?, featured_links = ?, updated_at = '2026-01-02 03:04:05' WHERE id = ?", [photo, links, id]);
    await q("INSERT INTO access_card_analytics (business_card_id, event_type, event_target) VALUES (?, 'link_click', 'https://node.glamlink.net/images/menu.png')", [id]);
    const [stamped] = await q('SELECT updated_at FROM business_cards WHERE id = ?', [id]);

    const logs = [];
    await migration.up({ sequelize: app.sequelize, log: (line) => logs.push(line) });
    const [card] = await q('SELECT profile_image, featured_links, updated_at FROM business_cards WHERE id = ?', [id]);
    assert.equal(card.profile_image, `${base}/images/me.png`);
    assert.ok(text(card.featured_links).includes(`${base}/images/menu.png`));
    assert.ok(!text(card.featured_links).includes('node.glamlink.net'));
    assert.equal(String(card.updated_at), String(stamped.updated_at), 'updated_at stays as it was');
    const [event] = await q('SELECT event_target FROM access_card_analytics WHERE business_card_id = ?', [id]);
    assert.equal(event.event_target, 'https://node.glamlink.net/images/menu.png');
    assert.ok(logs.some((line) => line.includes('business_cards.profile_image')));

    await migration.down({ sequelize: app.sequelize });
    const [restored] = await q('SELECT profile_image, featured_links FROM business_cards WHERE id = ?', [id]);
    assert.equal(restored.profile_image, photo);
    assert.ok(text(restored.featured_links).includes('https://node.glamlink.net/images/menu.png'));

    // Leave the database as the migrations left it.
    await migration.up({ sequelize: app.sequelize, log: () => {} });
});
