// Drafts, one card per person, claiming a draft, deleting and re-creating (website/access-card/cardOwnership.js,
// docs/access.md sections 4 and 5).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const { cardFields, cardFiles } = require('./cardFixtures');

let app, q, insert, createSession;
const tokens = {};
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    ({ createSession } = require('../src/shared/identity'));
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (6, 'User', 'USR'), (7, 'Professional', 'PRO')");
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Test Admin', ?, 1, 1)", [`admin-${stamp}@test.example`]);
    tokens.admin = jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' });
});
after(() => app.close());

// A signed-in professional with this email; returns { id, token }.
const person = async (email, { subscription = 'INACTIVE' } = {}) => {
    const id = await insert(
        "INSERT INTO users (email, role_id, account_type, professional_type, status, is_active, email_verified_at, subscription_status) VALUES (?, 7, 'professional', 'individual', 'ACCEPTED', 1, NOW(), ?)",
        [email, subscription],
    );
    return { id, token: (await createSession({ id }, { client: 'test' })).tokens.access_token };
};
const guestCard = async (email) => {
    const res = await app.form('POST', '/api/v1/businessCard', { fields: cardFields({ email }), files: cardFiles() });
    assert.equal(res.status, 201, res.body.message);
    return res.body.data;
};
const signedInCard = (who, fields = {}) =>
    app.form('POST', '/api/v1/businessCard/createBusinessCard', { fields: cardFields(fields), files: cardFiles(), token: who.token });
const cardRow = async (id) => (await q('SELECT * FROM business_cards WHERE id = ?', [id]))[0];
const slugOf = (link) => link.split('/access/')[1];

describe('a guest card is a draft', () => {
    let draft;
    const email = `guest-${stamp}@test.example`;

    test('made by a guest: a draft, not public, not listed', async () => {
        draft = await guestCard(email);
        assert.equal(draft.status, 'draft');
        assert.equal(draft.next_step, 'plan_selection');
        assert.equal(draft.account_exists, false);
        assert.equal((await app.request('GET', `/api/v1/businessCard/getBusinessCard/${slugOf(draft.business_card_link)}`)).status, 404);
        const listed = await app.request('GET', '/api/v1/businessCard/getAllProfiles');
        assert.ok(!listed.body.data.some((c) => c.id === draft.business_card_id));
        const adminList = await app.request('GET', '/api/v1/businessCard/getAllBusinessCards', { token: tokens.admin });
        assert.ok(!adminList.body.data.some((c) => c.id === draft.business_card_id), 'drafts are listed apart');
        const drafts = await app.request('GET', '/api/v1/businessCard/getAllBusinessCards?status=draft', { token: tokens.admin });
        assert.ok(drafts.body.data.some((c) => c.id === draft.business_card_id));
    });

    test('choosing Free: an account is made and the card goes live', async () => {
        const res = await app.request('POST', '/api/v1/businessCard/select-plan', {
            body: { business_card_id: draft.business_card_id, plan_type: 'free' }, headers: { 'x-card-token': draft.card_token },
        });
        assert.equal(res.status, 200, res.body.message);
        const card = await cardRow(draft.business_card_id);
        assert.equal(card.status, 'accepted');
        assert.ok(card.user_id);
        assert.equal((await app.request('GET', `/api/v1/businessCard/getBusinessCard/${slugOf(draft.business_card_link)}`)).status, 200);
        assert.ok(app.outbox.some((m) => m.to === email && /reset-password\?token=/.test(m.html || m.text || '')), 'set-password email');
    });
});

describe('a guest whose email already has an account', () => {
    let owner, draft;

    before(async () => {
        owner = await person(`owner-${stamp}@test.example`);
        draft = await guestCard(`owner-${stamp}@test.example`);
    });

    test('is asked to sign in, and cannot choose a plan or pay as a guest', async () => {
        assert.equal(draft.status, 'draft');
        assert.equal(draft.next_step, 'sign_in');
        assert.equal(draft.account_exists, true);
        assert.equal((await cardRow(draft.business_card_id)).user_id, null, 'never attached without signing in');
        const headers = { 'x-card-token': draft.card_token };
        const body = { business_card_id: draft.business_card_id };
        for (const [path, plan] of [['select-plan', 'free'], ['select-plan', 'subscription_only'], ['shipping-rate-public', 'nfc_only'], ['create-subscription-public', 'subscription_only']]) {
            const res = await app.request('POST', `/api/v1/businessCard/${path}`, { body: { ...body, plan_type: plan }, headers });
            assert.equal(res.status, 409, `${path} ${plan}`);
            assert.equal(res.body.code, 'ACCOUNT_EXISTS');
        }
    });

    test('signed in, claims the draft with its card token', async () => {
        const noToken = await app.request('POST', `/api/v1/access/cards/${draft.business_card_id}/claim`, { token: owner.token });
        assert.equal(noToken.status, 401);
        assert.equal(noToken.body.code, 'CARD_TOKEN_REQUIRED');
        const stranger = await person(`stranger-${stamp}@test.example`);
        const res = await app.request('POST', `/api/v1/access/cards/${draft.business_card_id}/claim`, { token: owner.token, headers: { 'x-card-token': draft.card_token } });
        assert.equal(res.status, 200, res.body.message);
        const card = await cardRow(draft.business_card_id);
        assert.equal(String(card.user_id), String(owner.id));
        assert.equal(card.status, 'accepted');
        const again = await app.request('POST', `/api/v1/access/cards/${draft.business_card_id}/claim`, { token: stranger.token, headers: { 'x-card-token': draft.card_token } });
        assert.equal(again.status, 409);
        assert.equal(again.body.code, 'CARD_NOT_CLAIMABLE');
    });

    test('a second draft: CARD_EXISTS, or replace the card and keep its link', async () => {
        const first = await cardRow(draft.business_card_id);
        const second = await guestCard(`owner-${stamp}@test.example`);
        const path = `/api/v1/access/cards/${second.business_card_id}/claim`;
        const headers = { 'x-card-token': second.card_token };
        const refused = await app.request('POST', path, { token: owner.token, headers });
        assert.equal(refused.status, 409);
        assert.equal(refused.body.code, 'CARD_EXISTS');
        assert.equal(refused.body.details.card_id, first.id);
        const replaced = await app.request('POST', path, { token: owner.token, headers, body: { replace: true } });
        assert.equal(replaced.status, 200, replaced.body.message);
        assert.equal(replaced.body.data.business_card_link, first.business_card_link, 'the link carries over');
        const old = await q('SELECT deleted_at FROM business_cards WHERE id = ?', [first.id]);
        assert.ok(old[0].deleted_at, 'the replaced card is deleted, not erased');
    });
});

describe('one card per person, signed in', () => {
    let pro;

    test('a second card is refused; replace swaps it and keeps the link', async () => {
        pro = await person(`pro-${stamp}@test.example`, { subscription: 'ACTIVE' });
        const first = await signedInCard(pro);
        assert.equal(first.status, 201, first.body.message);
        assert.equal(first.body.data.plan_type, 'subscription_only', 'the subscription is the person\'s');
        const second = await signedInCard(pro);
        assert.equal(second.status, 409);
        assert.equal(second.body.code, 'CARD_EXISTS');
        const replaced = await signedInCard(pro, { replace: 'true', name: 'Someone Else' });
        assert.equal(replaced.status, 201, replaced.body.message);
        assert.equal(replaced.body.data.business_card_link, first.body.data.business_card_link);
    });

    test('the owner deletes their card; the next one takes its link, keychain and plan', async () => {
        const [live] = await q('SELECT id, business_card_link FROM business_cards WHERE user_id = ? AND deleted_at IS NULL', [pro.id]);
        await q("UPDATE business_cards SET nfc_status = 'paid' WHERE id = ?", [live.id]);
        const stranger = await person(`not-owner-${stamp}@test.example`);
        assert.equal((await app.request('DELETE', `/api/v1/access/cards/${live.id}`, { token: stranger.token })).status, 404);
        const res = await app.request('DELETE', `/api/v1/access/cards/${live.id}`, { token: pro.token });
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual(res.body.data, { deleted: true, subscription_continues: true });
        const next = await signedInCard(pro, { name: 'New Name' });
        assert.equal(next.status, 201, next.body.message);
        assert.equal(next.body.data.business_card_link, live.business_card_link);
        assert.equal(next.body.data.nfc_status, 'paid');
        assert.equal(next.body.data.plan_type, 'nfc_with_subscription');
    });
});

describe('cards bought while signed out', () => {
    test('a verified email gets its paid card, never a draft, and only when it has none', async () => {
        const { attachGuestBusinessCards } = require('../src/shared/identity/account.service');
        const email = `attach-${stamp}@test.example`;
        const draftId = await insert("INSERT INTO business_cards (email, status, is_active) VALUES (?, 'draft', 1)", [email]);
        const paidId = await insert("INSERT INTO business_cards (email, status, is_active) VALUES (?, 'accepted', 1)", [email]);
        const who = await person(email);
        await attachGuestBusinessCards({ id: who.id, email });
        assert.equal((await cardRow(draftId)).user_id, null);
        assert.equal(String((await cardRow(paidId)).user_id), String(who.id));
    });
});
