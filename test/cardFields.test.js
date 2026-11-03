// The card takes exactly the website form's fields, checked the same way (website/access-card/cardFields.js,
// cardMedia.js, cardWriter.js), and the public sees no private fields (cardPublic.js).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const { cardFields, cardFiles, photo, video } = require('./cardFixtures');
const { readCard } = require('../src/website/access-card/cardFields');
const { planMedia } = require('../src/website/access-card/cardMedia');

const field = (fn) => {
    try {
        fn();
    } catch (err) {
        assert.equal(err.code, 'INVALID_CARD', err.message);
        return err.details.field;
    }
    assert.fail('expected INVALID_CARD');
};
const asJson = (fields) => Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]));

describe('reading a new card', () => {
    test('normalizes the website form', () => {
        const { card, locations, hours } = readCard(asJson(cardFields({ phone: '(555) 123-4567' })));
        assert.equal(card.phone, '5551234567');
        assert.equal(card.color_code, '#24BBCB');
        assert.equal(card.website, 'https://example.com');
        assert.deepEqual(card.specialties, ['Balayage', 'Bridal Hair']);
        assert.equal(card.primary_specialty, 'Balayage');
        assert.equal(card.preferred_booking_method, '["GO_TO_BOOKING_LINK","CALL_TEXT"]');
        assert.deepEqual(card.social_media, { instagram: '@jane' });
        assert.equal(card.custom_handle, undefined);
        assert.equal(card.elite_setup, undefined);
        assert.deepEqual(locations.map((l) => [l.location_type, l.is_primary, l.sort_order]), [['exact_address', false, 1], ['city_only', true, 2]]);
        assert.deepEqual(hours, [{ note: 'Mon-Fri: 9am - 6pm' }]);
    });

    test('names the field that fails, like the website form', () => {
        assert.equal(field(() => readCard(asJson(cardFields({ name: '' })))), 'name');
        assert.equal(field(() => readCard(asJson(cardFields({ email: 'not-an-email' })))), 'email');
        assert.equal(field(() => readCard(asJson(cardFields({ phone: '555' })))), 'phone');
        assert.equal(field(() => readCard(asJson(cardFields({ bio: '<p><br></p>' })))), 'bio');
        assert.equal(field(() => readCard(asJson(cardFields({ bio: `<p>${'x'.repeat(81)}</p>` })))), 'bio');
        assert.equal(field(() => readCard(asJson(cardFields({ specialties: [] })))), 'specialties');
        assert.equal(field(() => readCard(asJson(cardFields({ specialties: ['a', 'b', 'c', 'd', 'e', 'f'] })))), 'specialties');
        assert.equal(field(() => readCard(asJson(cardFields({ preferred_booking_method: [] })))), 'preferred_booking_methods');
        assert.equal(field(() => readCard(asJson(cardFields({ booking_link: '', website: '' })))), 'booking_link');
        assert.equal(field(() => readCard(asJson(cardFields({ preferred_booking_method: ['DM_INSTAGRAM'], social_media: {} })))), 'instagram');
        assert.equal(field(() => readCard(asJson(cardFields({ locations: [{ location_type: 'city_only', city: 'Reno' }] })))), 'locations');
        assert.equal(field(() => readCard(asJson(cardFields({ professional_type: 'salon' })))), 'professional_type');
        assert.equal(field(() => readCard(asJson(cardFields({ color_code: '#24bbc' })))), 'color_code');
        assert.equal(field(() => readCard(asJson(cardFields({ featured_links: [{ url: 'https://a.example', is_featured: true }, { url: 'https://b.example', is_featured: true }] })))), 'featured_links');
    });

    test('a hidden phone is optional', () => {
        const { card } = readCard(asJson(cardFields({ phone: '', is_phone_visible: 'false' })));
        assert.equal(card.is_phone_visible, false);
    });

    test('locations are optional; one that is sent must be complete', () => {
        assert.deepEqual(readCard(asJson(cardFields({ locations: [] }))).locations, []);
        const { locations } = readCard(asJson(cardFields({ locations: undefined })));
        assert.deepEqual(locations, []);
    });

    test("a professional's card unless it says brand", () => {
        assert.equal(readCard(asJson(cardFields())).card.professional_type, 'individual');
        assert.equal(readCard(asJson(cardFields({ professional_type: 'brand' }))).card.professional_type, 'brand');
    });

    test("a brand's title, specialties and booking method are optional", () => {
        const { card } = readCard(asJson(cardFields({ professional_type: 'brand', professional_title: '', specialties: [], preferred_booking_method: [] })));
        assert.equal(card.professional_title, null);
        assert.deepEqual(card.specialties, []);
        assert.equal(card.primary_specialty, null);
        assert.equal(card.preferred_booking_method, '[]');
        // A professional's are still required.
        assert.equal(field(() => readCard(asJson(cardFields({ professional_title: '' })))), 'professional_title');
    });

    test('special offers are not read any more', () => {
        const { card } = readCard(asJson(cardFields({ offer_promotion: 'true', promotion_details: '10% off' })));
        assert.ok(!('offer_promotion' in card) && !('promotion_details' in card));
    });
});

describe('reading an edit', () => {
    const current = { bio: `<p>${'An older, longer bio. '.repeat(10)}</p>`, phone: '+1 (555) 123-4567', is_phone_visible: true, preferred_booking_method: '["CALL_TEXT"]', social_media: '{}' };

    test('changes only the fields sent', () => {
        const { card, locations, hours } = readCard({ name: 'New Name' }, { current });
        assert.deepEqual(card, { name: 'New Name' });
        assert.equal(locations, undefined);
        assert.equal(hours, undefined);
    });

    test('a stored bio over the limit can stay; a new one cannot', () => {
        assert.equal(readCard({ bio: current.bio }, { current }).card.bio, current.bio);
        assert.equal(field(() => readCard({ bio: `${current.bio}<p>more</p>` }, { current })), 'bio');
    });

    test('a stored phone in another format does not block other edits', () => {
        assert.deepEqual(readCard({ is_phone_visible: 'true' }, { current }).card, { is_phone_visible: true });
    });
});

describe('photos and videos', () => {
    const limits = { photos: 4, videos: 1 };
    const files = (photos, videos = 0) => ({
        profile_image: [{ mimetype: 'image/png', filename: 'u/me.png' }],
        images: Array.from({ length: photos }, (_, i) => ({ mimetype: 'image/png', filename: `u/p${i}.png`, size: 10 })),
        videos: Array.from({ length: videos }, (_, i) => ({ mimetype: 'video/mp4', filename: `u/v${i}.mp4`, size: 10 })),
        video_thumbnails: Array.from({ length: videos }, (_, i) => ({ mimetype: 'image/png', filename: `u/t${i}.png` })),
    });
    const mediaField = (args) => field(() => planMedia({ body: {}, creating: true, limits, ...args }));

    test('a new card needs a profile image and something in the gallery', () => {
        assert.equal(mediaField({ files: { images: files(1).images } }), 'profile_image');
        assert.equal(mediaField({ files: files(0) }), 'images');
    });

    test('up to 4 photos and 1 video, each video with its thumbnail', () => {
        assert.equal(planMedia({ files: files(4, 1), body: {}, creating: true, limits }).add.length, 5);
        assert.equal(mediaField({ files: files(5) }), 'images');
        assert.equal(mediaField({ files: files(1, 2) }), 'images');
        assert.equal(mediaField({ files: { ...files(1, 1), video_thumbnails: [] } }), 'images');
        assert.equal(mediaField({ files: { ...files(1), videos: [{ mimetype: 'video/quicktime', originalname: 'a.mov', filename: 'u/a.mov', size: 1 }], video_thumbnails: [{ mimetype: 'image/png', filename: 'u/t.png' }] } }), 'images');
    });

    test('an edit keeps, removes and adds; a card over the limit keeps its photos but cannot add', () => {
        const existing = [1, 2, 3, 4, 5].map((id) => ({ id, file_type: 'image', sort_order: id }));
        const keepThree = planMedia({ files: { images: files(1).images }, body: { existing_image_ids: '[1,2,3]' }, existing, creating: false, limits });
        assert.deepEqual(keepThree.removeIds, [4, 5]);
        assert.equal(keepThree.add[0].sort_order, 6);
        assert.deepEqual(planMedia({ files: {}, body: {}, existing, creating: false, limits }).removeIds, []);
        assert.equal(field(() => planMedia({ files: { images: files(1).images }, body: {}, existing, creating: false, limits })), 'images');
    });
});

let app, q;
const tokens = {};
before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    const insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (7, 'Professional', 'PRO')");
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Test Admin', ?, 1, 1)", [`admin-${stamp}@test.example`]);
    tokens.admin = jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' });
});
after(() => app.close());

describe('creating and editing through the API', () => {
    let cardId, cardToken, slug;

    test('a guest card from the website form', async () => {
        const res = await app.form('POST', '/api/v1/businessCard', { fields: cardFields(), files: cardFiles({ images: [photo(), photo('b.png')], videos: [video()], video_thumbnails: [photo('t.png')] }) });
        assert.equal(res.status, 201, res.body.message);
        ({ business_card_id: cardId, card_token: cardToken } = res.body.data);
        slug = res.body.data.business_card_link.split('/access/')[1];
        const [card] = await q('SELECT * FROM business_cards WHERE id = ?', [cardId]);
        assert.equal(card.primary_specialty, 'Balayage');
        assert.equal(card.custom_handle, null, 'not a card field any more');
        assert.equal(card.elite_setup, 0);
        assert.ok(card.business_card_qr.endsWith(`/images/qr/${slug}.png`));
        const locations = await q('SELECT label, is_primary FROM business_locations WHERE business_card_id = ? ORDER BY sort_order', [cardId]);
        assert.deepEqual(locations.map((l) => [l.label, l.is_primary]), [['Studio', 0], ['Henderson', 1]]);
        const media = await q('SELECT file_type, caption, is_thumbnail, thumbnail_uri FROM business_gallery_media WHERE business_card_id = ? ORDER BY sort_order', [cardId]);
        assert.deepEqual(media.map((m) => [m.file_type, m.caption]), [['image', 'Before'], ['image', null], ['video', null]]);
        assert.ok(media[2].thumbnail_uri);
    });

    test("a brand's guest card with no location, title or specialties", async () => {
        const res = await app.form('POST', '/api/v1/businessCard', {
            fields: cardFields({ professional_type: 'brand', email: `brand-${Date.now()}@test.example`, professional_title: '', specialties: [], preferred_booking_method: [], locations: [] }),
            files: cardFiles(),
        });
        assert.equal(res.status, 201, res.body.message);
        const [card] = await q('SELECT professional_type, professional_title, primary_specialty FROM business_cards WHERE id = ?', [res.body.data.business_card_id]);
        assert.deepEqual(card, { professional_type: 'brand', professional_title: null, primary_specialty: null });
        const locations = await q('SELECT id FROM business_locations WHERE business_card_id = ?', [res.body.data.business_card_id]);
        assert.equal(locations.length, 0);
    });

    test('a refused card says which field', async () => {
        const res = await app.form('POST', '/api/v1/businessCard', { fields: cardFields({ phone: '12' }), files: cardFiles() });
        assert.equal(res.status, 400);
        assert.equal(res.body.code, 'INVALID_CARD');
        assert.deepEqual(res.body.details, { field: 'phone' });
    });

    test('an edit with the card token changes only what it sends', async () => {
        const res = await app.form('PUT', `/api/v1/businessCard/updateBusinessCard/${cardId}`, {
            fields: { professional_title: 'Colour Specialist', existing_image_ids: '[]', existing_video_ids: '[]' },
            files: { images: [photo('new.png')] },
            headers: { 'x-card-token': cardToken },
        });
        assert.equal(res.status, 200, res.body.message);
        const [card] = await q('SELECT name, professional_title FROM business_cards WHERE id = ?', [cardId]);
        assert.deepEqual(card, { name: 'Jane Smith', professional_title: 'Colour Specialist' });
        const media = await q('SELECT file_name FROM business_gallery_media WHERE business_card_id = ? AND deleted_at IS NULL', [cardId]);
        assert.equal(media.length, 1);
    });

    test('professional or brand: an owner cannot change it; an admin changes the account with the card', async () => {
        await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (8, 'Brand', 'BRND')");
        const user = await q("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active) VALUES (?, 7, 'professional', 'individual', 'ACCEPTED', 1)",
            [`typed-${Date.now()}@test.example`]);
        const userId = user.insertId ?? user;
        const edit = (fields, headers) => app.form('PUT', `/api/v1/businessCard/updateBusinessCard/${cardId}`, { fields, files: {}, headers });
        // The draft's own edit (its card token): accepted, without the type or a claim
        const own = await edit({ name: 'Jane Smith', professional_type: 'brand', claimed_place_id: 'ChIJ-not-from-an-edit' }, { 'x-card-token': cardToken });
        assert.equal(own.status, 200, own.body.message);
        const [mine] = await q('SELECT professional_type, claimed_place_id FROM business_cards WHERE id = ?', [cardId]);
        assert.deepEqual(mine, { professional_type: 'individual', claimed_place_id: null });

        await q('UPDATE business_cards SET user_id = ? WHERE id = ?', [userId, cardId]);
        const res = await edit({ professional_type: 'brand', professional_title: '' }, { Authorization: `Bearer ${tokens.admin}` });
        assert.equal(res.status, 200, res.body.message);
        const [card] = await q('SELECT professional_type FROM business_cards WHERE id = ?', [cardId]);
        const [account] = await q('SELECT professional_type, role_id FROM users WHERE id = ?', [userId]);
        assert.equal(card.professional_type, 'brand');
        assert.deepEqual([account.professional_type, Number(account.role_id)], ['brand', 8]);
        await q('UPDATE business_cards SET user_id = NULL WHERE id = ?', [cardId]);
    });

    test('the public card hides a hidden phone and the private fields', async () => {
        // A guest's card is public once a plan is chosen (cardOwnership.test.js); here it is made live directly.
        await q("UPDATE business_cards SET is_phone_visible = 0, status = 'accepted' WHERE id = ?", [cardId]);
        const res = await app.request('GET', `/api/v1/businessCard/getBusinessCard/${slug}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.data.phone, null);
        for (const key of ['user_id', 'plan_type', 'nfc_status', 'business_user', 'shipping_amount', 'excites_about_glamlink']) {
            assert.ok(!(key in res.body.data), key);
        }
        const all = await app.request('GET', '/api/v1/businessCard/getAllProfiles');
        const listed = all.body.data.find((c) => c.id === cardId);
        assert.equal(listed.phone, null);
        assert.ok(!('business_user' in listed));
    });

    test('a card by id: the whole card for an admin, the public card for others', async () => {
        const asAdmin = await app.request('GET', `/api/v1/businessCard/getBusinessCardById/${cardId}`, { token: tokens.admin });
        assert.equal(asAdmin.body.data.phone, '5551234567');
        const asPublic = await app.request('GET', `/api/v1/businessCard/getBusinessCardById/${cardId}`, { token: 'stale-token' });
        assert.equal(asPublic.status, 200);
        assert.equal(asPublic.body.data.phone, null);
        await q("UPDATE business_cards SET status = 'pending' WHERE id = ?", [cardId]);
        const hidden = await app.request('GET', `/api/v1/businessCard/getBusinessCardById/${cardId}`);
        assert.equal(hidden.status, 404);
    });
});
