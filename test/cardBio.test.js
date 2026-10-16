// Card bios are cleaned on every save (website/access-card/cardBio.js); the directory filter takes its location as
// a value, not SQL.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');
const { cardFields, cardFiles } = require('./cardFixtures');
const { sanitizeBio, bioMarkupRemoved } = require('../src/website/access-card');

const ATTACK = '<p onclick="steal()">Hi<script>alert(1)</script><img src=x onerror="alert(2)"> <a href="javascript:alert(3)">x</a> '
    + '<a href="https://example.com/book">Book</a></p><iframe src="https://evil.example"></iframe><p style="color:red">Red</p>';

describe('cleaning a bio', () => {
    test('keeps the editor formatting and links', () => {
        const bio = '<h3>About</h3><p><strong>Bold</strong> <em>it</em> <u>u</u> <s>s</s><br></p><ul><li><p>one</p></li></ul><ol><li>two</li></ol>'
            + '<blockquote><p>q</p></blockquote><p><a href="mailto:me@example.com">mail</a> <a href="tel:+15550100">call</a></p>';
        const clean = sanitizeBio(bio);
        for (const tag of ['<h3>', '<strong>', '<em>', '<u>', '<s>', '<br />', '<ul>', '<ol>', '<li>', '<blockquote>']) assert.ok(clean.includes(tag), tag);
        assert.ok(clean.includes('href="mailto:me@example.com"'));
        assert.ok(clean.includes('href="tel:+15550100"'));
        assert.deepEqual(bioMarkupRemoved(bio), []);
    });

    test('drops scripts, handlers, images, frames, styles and other link schemes', () => {
        const clean = sanitizeBio(ATTACK);
        for (const bad of ['script', 'alert(1)', 'onclick', 'onerror', '<img', 'javascript:', 'iframe', 'style=']) assert.ok(!clean.includes(bad), bad);
        assert.ok(clean.includes('<a href="https://example.com/book" target="_blank" rel="noopener noreferrer nofollow">Book</a>'));
        assert.ok(clean.includes('Red'), 'the text of a removed attribute stays');
        assert.deepEqual(bioMarkupRemoved(ATTACK).sort(), ['<iframe>', '<img>', '<script>', 'a[href=javascript:]', 'p[onclick]', 'p[style]']);
    });

    test('a bio that only changes how it is written loses nothing', () => {
        assert.deepEqual(bioMarkupRemoved('Hair & Makeup\r\nLas Vegas'), []);
        assert.deepEqual(bioMarkupRemoved('<p>Brows &amp; lashes</p>'), []);
    });
});

let app, q;
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
});
after(() => app.close());

describe('saving a card', () => {
    let cardId, cardToken;

    test('a new card stores its bio cleaned', async () => {
        const res = await app.form('POST', '/api/v1/businessCard', { fields: cardFields({ bio: ATTACK }), files: cardFiles() });
        assert.equal(res.status, 201);
        ({ business_card_id: cardId, card_token: cardToken } = res.body.data);
        const [{ bio }] = await q('SELECT bio FROM business_cards WHERE id = ?', [cardId]);
        assert.equal(bio, sanitizeBio(ATTACK));
        assert.ok(!bio.includes('script') && !bio.includes('onclick'));
    });

    test('an edit stores its bio cleaned', async () => {
        const res = await app.form('PUT', `/api/v1/businessCard/updateBusinessCard/${cardId}`, {
            fields: { bio: '<p>New<script>x()</script></p>' }, headers: { 'x-card-token': cardToken },
        });
        assert.equal(res.status, 200);
        const [{ bio }] = await q('SELECT bio FROM business_cards WHERE id = ?', [cardId]);
        assert.equal(bio, '<p>New</p>');
    });
});

describe('the directory location filter', () => {
    let cardId;
    before(async () => {
        const res = await q("INSERT INTO business_cards (name, email, status, is_active) VALUES ('Filter Test', ?, 'accepted', 1)", [`filter-${stamp}@test.example`]);
        cardId = res.insertId ?? res;
        await q("INSERT INTO business_locations (business_card_id, city, state, is_primary) VALUES (?, 'Testville', 'ZZ', 1)", [cardId]);
    });
    const filter = (location) => app.request('GET', `/api/v1/businessCard/filter?location=${encodeURIComponent(location)}`);

    test('finds cards in the city', async () => {
        const res = await filter('Testville, ZZ');
        assert.equal(res.status, 200);
        assert.ok(res.body.data.some((c) => c.id === cardId));
    });

    test('a location written as SQL matches nothing', async () => {
        const res = await filter("Nowhere, QQ' OR '1'='1");
        assert.equal(res.status, 200);
        assert.equal(res.body.data.length, 0);
    });
});
