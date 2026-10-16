// What a card's owner may change on their plan (website/access-card/entitlements.js, docs/access.md section 2).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const { cardFields, cardFiles, photo } = require('./cardFixtures');

let app, q, insert;
const tokens = {};
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const DEFAULTS = {
    free: { photos: 4, videos: 1, edit_details: true, edit_media: false, special_offers: false, analytics: false, priority_search: false },
    pro: { photos: 4, videos: 1, edit_details: true, edit_media: true, special_offers: true, analytics: true, priority_search: true },
};

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (7, 'Professional', 'PRO')");
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Test Admin', ?, 1, 1)", [`admin-${stamp}@test.example`]);
    tokens.admin = jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' });
});
after(async () => {
    await q("UPDATE access_settings SET value = ? WHERE setting = 'entitlements'", [JSON.stringify(DEFAULTS)]);
    await app.close();
});

// A signed-in person with a live card (two photos), Pro when `pro`.
const owner = async ({ pro = false } = {}) => {
    const { createSession } = require('../src/shared/identity');
    const id = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active, email_verified_at) VALUES (?, 7, 'professional', 'individual', 'ACCEPTED', 1, NOW())", [`owner-${stamp}-${Math.floor(Math.random() * 1e9)}@test.example`]);
    if (pro) await insert("INSERT INTO access_subscriptions (user_id, source, status) VALUES (?, 'comp', 'active')", [id]);
    const token = (await createSession({ id }, { client: 'test' })).tokens.access_token;
    const res = await app.form('POST', '/api/v1/businessCard/createBusinessCard', { fields: cardFields(), files: cardFiles({ images: [photo('a.png'), photo('b.png')] }), token });
    assert.equal(res.status, 201, res.body.message);
    const cardId = res.body.data.id;
    const media = await q("SELECT id, caption FROM business_gallery_media WHERE business_card_id = ? AND deleted_at IS NULL ORDER BY sort_order", [cardId]);
    return { id, token, cardId, mediaIds: media.map((m) => m.id), captions: media.map((m) => m.caption), slug: res.body.data.business_card_link.split('/access/')[1] };
};
const editCard = (who, fields, { files, token } = {}) =>
    app.form('PUT', `/api/v1/businessCard/updateBusinessCard/${who.cardId}`, { fields, files, token: token || who.token });
const refused = (res, feature) => {
    assert.equal(res.status, 403, res.body.message);
    assert.equal(res.body.code, 'UPGRADE_REQUIRED');
    assert.equal(res.body.details.feature, feature);
};

describe('a Free card once it is live', () => {
    let free;
    before(async () => { free = await owner(); });

    test('its owner keeps the details current; the whole form sent back unchanged passes', async () => {
        const res = await editCard(free, cardFields({
            name: 'New Name',
            existing_image_ids: JSON.stringify(free.mediaIds),
            existing_images_gallery_meta: JSON.stringify(free.captions.map((caption, i) => ({ caption, is_thumbnail: i === 0 }))),
            existing_video_ids: '[]',
        }));
        assert.equal(res.status, 200, res.body.message);
    });

    test('swapping photos or the video needs Pro', async () => {
        refused(await editCard(free, { existing_image_ids: JSON.stringify(free.mediaIds) }, { files: { images: [photo('c.png')] } }), 'edit_media');
        refused(await editCard(free, { existing_image_ids: JSON.stringify(free.mediaIds.slice(1)) }), 'edit_media');
        refused(await editCard(free, { existing_image_ids: JSON.stringify(free.mediaIds), existing_images_gallery_meta: JSON.stringify([{ caption: 'New caption' }]) }), 'edit_media');
        refused(await editCard(free, {}, { files: { profile_image: [photo('me2.png')] } }), 'edit_media');
    });

    test('a special offer needs Pro, and is never shown for a Free card', async () => {
        refused(await editCard(free, { offer_promotion: 'true', promotion_details: '10% off' }), 'special_offers');
        await q("UPDATE business_cards SET offer_promotion = 1, promotion_details = 'Old offer' WHERE id = ?", [free.cardId]);
        const shown = await app.request('GET', `/api/v1/businessCard/getBusinessCard/${free.slug}`);
        assert.equal(shown.body.data.offer_promotion, false);
        assert.equal(shown.body.data.promotion_details, null);
        assert.equal((await editCard(free, { offer_promotion: 'false' })).status, 200, 'turning it off is fine');
    });

    test('an admin may change anything', async () => {
        const res = await editCard(free, { existing_image_ids: JSON.stringify(free.mediaIds), offer_promotion: 'true', promotion_details: 'Admin offer' }, { files: { images: [photo('d.png')] }, token: tokens.admin });
        assert.equal(res.status, 200, res.body.message);
    });

    test('with editing switched off for Free, details need Pro too (featured links included)', async () => {
        await q("UPDATE access_settings SET value = ? WHERE setting = 'entitlements'", [JSON.stringify({ ...DEFAULTS, free: { ...DEFAULTS.free, edit_details: false } })]);
        refused(await editCard(free, { name: 'Another Name' }), 'edit_details');
        const reorder = await app.request('PUT', `/api/v1/businessCard/${free.cardId}/featured-links/reorder`, { token: free.token, body: { featured_links: [{ title: 'X', url: 'https://x.example' }] } });
        refused(reorder, 'edit_details');
        await q("UPDATE access_settings SET value = ? WHERE setting = 'entitlements'", [JSON.stringify(DEFAULTS)]);
    });
});

describe('an admin-made gallery', () => {
    test('an admin may put up to 20 photos on a card; its owner then cannot add more than the plan allows', async () => {
        const pro = await owner({ pro: true });
        const added = await editCard(pro, { existing_image_ids: JSON.stringify(pro.mediaIds) }, {
            files: { images: ['p1', 'p2', 'p3', 'p4'].map((name) => photo(`${name}.png`)) }, token: tokens.admin,
        });
        assert.equal(added.status, 200, added.body.message);
        const ids = (await q('SELECT id FROM business_gallery_media WHERE business_card_id = ? AND deleted_at IS NULL ORDER BY sort_order', [pro.cardId])).map((m) => m.id);
        assert.equal(ids.length, 6);
        const more = await editCard(pro, { existing_image_ids: JSON.stringify(ids) }, { files: { images: [photo('p5.png')] } });
        assert.equal(more.status, 400);
        assert.equal(more.body.message, 'Up to 4 photos.');
    });
});

describe('a Pro card', () => {
    test('swaps photos and runs an offer, shown publicly; when Pro ends the offer is hidden, not deleted', async () => {
        const pro = await owner({ pro: true });
        const res = await editCard(pro, { existing_image_ids: JSON.stringify(pro.mediaIds.slice(1)), offer_promotion: 'true', promotion_details: '20% off first visit' }, { files: { images: [photo('e.png')] } });
        assert.equal(res.status, 200, res.body.message);
        let shown = await app.request('GET', `/api/v1/businessCard/getBusinessCard/${pro.slug}`);
        assert.deepEqual([shown.body.data.offer_promotion, shown.body.data.promotion_details], [true, '20% off first visit']);
        await q("UPDATE access_subscriptions SET status = 'canceled' WHERE user_id = ?", [pro.id]);
        shown = await app.request('GET', `/api/v1/businessCard/getBusinessCard/${pro.slug}`);
        assert.equal(shown.body.data.offer_promotion, false);
        assert.equal((await q('SELECT promotion_details FROM business_cards WHERE id = ?', [pro.cardId]))[0].promotion_details, '20% off first visit');
    });
});

describe('new cards and drafts', () => {
    test('a guest cannot start with an offer; the photo limit comes from the plan settings', async () => {
        refused(await app.form('POST', '/api/v1/businessCard', { fields: cardFields({ offer_promotion: 'true', promotion_details: 'x' }), files: cardFiles() }), 'special_offers');
        await q("UPDATE access_settings SET value = ? WHERE setting = 'entitlements'", [JSON.stringify({ ...DEFAULTS, free: { ...DEFAULTS.free, photos: 2 } })]);
        const tooMany = await app.form('POST', '/api/v1/businessCard', { fields: cardFields(), files: cardFiles({ images: [photo('1.png'), photo('2.png'), photo('3.png')] }) });
        assert.equal(tooMany.status, 400);
        assert.equal(tooMany.body.message, 'Up to 2 photos.');
        await q("UPDATE access_settings SET value = ? WHERE setting = 'entitlements'", [JSON.stringify(DEFAULTS)]);
    });

    test('a draft can be changed freely before it goes live', async () => {
        const draft = (await app.form('POST', '/api/v1/businessCard', { fields: cardFields(), files: cardFiles() })).body.data;
        const res = await app.form('PUT', `/api/v1/businessCard/updateBusinessCard/${draft.business_card_id}`, {
            fields: { existing_image_ids: '[]' }, files: { images: [photo('f.png')] }, headers: { 'x-card-token': draft.card_token },
        });
        assert.equal(res.status, 200, res.body.message);
    });
});
