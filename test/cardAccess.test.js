// The card token: who may act on a card in the logged-out purchase flow (website/access-card/cardAccess.middleware.js).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');

let app, q;
const ids = {};
const tokens = {};

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    // A raw INSERT answers with the new row's id.
    const insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    const { createSession } = require('../src/shared/identity');
    const { issueCardToken } = require('../src/website/access-card/cardToken');

    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (6, 'User', 'USR'), (7, 'Professional', 'PRO')");
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const user = (name) => insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active, email_verified_at) VALUES (?, 7, 'professional', 'individual', 'ACCEPTED', 1, NOW())", [`${name}-${stamp}@test.example`]);
    ids.owner = await user('owner');
    ids.stranger = await user('stranger');
    const address = () => insert("INSERT INTO user_address (user_id, address_line_1, province_code, postal_code, is_active) VALUES (NULL, '1 Test St', 'NV', '89101', 1)");
    ids.cardAddress = await address();
    ids.otherAddress = await address();
    const card = async (userId, addressId = null) =>
        insert("INSERT INTO business_cards (user_id, name, email, user_address_id, is_active) VALUES (?, 'Test Card', ?, ?, 1)", [userId, `card-${stamp}@test.example`, addressId]);
    ids.unowned = await card(null, ids.cardAddress);
    ids.other = await card(null);
    ids.owned = await card(ids.owner);

    tokens.unowned = issueCardToken(ids.unowned);
    tokens.owned = issueCardToken(ids.owned);
    tokens.owner = (await createSession({ id: ids.owner }, { client: 'test' })).tokens.access_token;
    tokens.stranger = (await createSession({ id: ids.stranger }, { client: 'test' })).tokens.access_token;
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Test Admin', ?, 1, 1)", [`admin-${stamp}@test.example`]);
    tokens.admin = jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' });
});
after(() => app.close());

const address = (cardId, { headers, query = '' } = {}) => app.request('GET', `/api/v1/order/getAddressByBusinessCardId/${cardId}${query}`, { headers });
const passedGuard = (res) => assert.ok(res.status !== 401 && res.body?.code !== 'CARD_TOKEN_REQUIRED', `guard let it through (got ${res.status} ${res.body?.message})`);

describe('the logged-out purchase flow', () => {
    test('no card token: refused', async () => {
        const res = await address(ids.unowned);
        assert.equal(res.status, 401);
        assert.equal(res.body.code, 'CARD_TOKEN_REQUIRED');
    });

    test('a card token for another card: refused', async () => {
        const res = await address(ids.other, { headers: { 'x-card-token': tokens.unowned } });
        assert.equal(res.status, 401);
        assert.equal(res.body.code, 'CARD_TOKEN_REQUIRED');
    });

    test('a forged card token: refused', async () => {
        const forged = jwt.sign({ sub: String(ids.unowned), typ: 'card' }, 'not-the-key', { expiresIn: '1h' });
        const res = await address(ids.unowned, { headers: { 'x-card-token': forged } });
        assert.equal(res.status, 401);
    });

    test('its own card token, as a header or in the query string: allowed', async () => {
        passedGuard(await address(ids.unowned, { headers: { 'x-card-token': tokens.unowned } }));
        passedGuard(await address(ids.unowned, { query: `?card_token=${encodeURIComponent(tokens.unowned)}` }));
    });

    test('in the body of a plan choice: allowed; without it: refused', async () => {
        const refused = await app.request('POST', '/api/v1/businessCard/shipping-rate-public', { body: { business_card_id: ids.unowned, plan_type: 'nfc_only' } });
        assert.equal(refused.status, 401);
        const allowed = await app.request('POST', '/api/v1/businessCard/shipping-rate-public', { body: { business_card_id: ids.unowned, plan_type: 'nfc_only', card_token: tokens.unowned } });
        passedGuard(allowed);
    });

    test('an owned card: its owner, an admin, or its card token; not another user', async () => {
        passedGuard(await address(ids.owned, { headers: { 'x-access-token': tokens.owner } }));
        passedGuard(await address(ids.owned, { headers: { 'x-access-token': tokens.admin } }));
        passedGuard(await address(ids.owned, { headers: { 'x-card-token': tokens.owned } }));
        const stranger = await address(ids.owned, { headers: { 'x-access-token': tokens.stranger } });
        assert.equal(stranger.status, 403);
    });
});

describe('editing a card', () => {
    const update = (cardId, headers) => app.request('PUT', `/api/v1/businessCard/updateBusinessCard/${cardId}`, { body: {}, headers });

    test('an unowned card needs its card token (it used to be open to anyone)', async () => {
        const res = await update(ids.unowned, {});
        assert.equal(res.status, 401);
        assert.equal(res.body.code, 'CARD_TOKEN_REQUIRED');
        passedGuard(await update(ids.unowned, { 'x-card-token': tokens.unowned }));
    });

    test('once owned, only the owner or an admin: the card token no longer counts', async () => {
        const res = await update(ids.owned, { 'x-card-token': tokens.owned });
        assert.equal(res.status, 401);
        assert.equal(res.body.code, 'SIGN_IN_REQUIRED');
        assert.equal((await update(ids.owned, { 'x-access-token': tokens.stranger })).status, 403);
        passedGuard(await update(ids.owned, { 'x-access-token': tokens.owner }));
    });
});

test('a card edits only its own address', async () => {
    const res = await app.request('PUT', `/api/v1/order/editAddress-public/${ids.otherAddress}`, {
        body: { business_card_id: ids.unowned, address_line_1: '2 Other St' },
        headers: { 'x-card-token': tokens.unowned },
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.message, 'This address does not belong to this card.');
});
