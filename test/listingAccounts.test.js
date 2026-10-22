// Directory listings become accounts (Mohit, Oct 23): approving an application makes (or finds) the account for its
// email and emails a "Set your password" link; the account's page is made from the listing; the owner keeps the
// listing up to date and manages their own products (shown at once); admins edit and add listings.
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const { photo } = require('./cardFixtures');

let app, q, insert, auth, createSession;
const stamp = `${Date.now()}`.slice(-8);
const ids = {};
const emailOf = (name) => `${name}-${stamp}@listing.example`;

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    ({ createSession } = require('../src/shared/identity'));
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (6, 'User', 'USR'), (7, 'Professional', 'PRO'), (8, 'Brand', 'BRND')");
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Listings Admin', ?, 1, 1)", [emailOf('admin')]);
    auth = { Authorization: `Bearer ${jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' })}` };
});
after(() => app.close());

const apply = async (name, overrides = {}) => {
    const res = await app.form('POST', '/api/v1/directory/applications', {
        fields: {
            name, email: emailOf(name.split(' ')[0].toLowerCase()), professional_title: 'Lash Artist', bio: 'Lash lifts and brow lamination in a calm studio.',
            primary_specialty: 'Lashes', specialties: ['Lashes', 'Brows'],
            locations: [{ label: 'Studio', location_type: 'exact_address', address: '9 Lash Ln', city: 'Las Vegas', state: 'NV', business_name: `${name} Studio`, phone: '7025550111', is_primary: true }],
            business_hours: [{ note: 'Tue–Sat 10–6' }], social_media: { instagram: 'https://instagram.com/lashes' }, ...overrides,
        },
        files: { profile_image: [photo('me.png')], images: [photo('one.png')] },
    });
    assert.equal(res.status, 201, res.body.message);
    return res.body.data.id;
};
const review = (id, body) => app.request('PUT', `/api/v1/directory/applications/${id}/status`, { body, headers: auth });
const accountOf = async (email) => (await q('SELECT id, password, professional_type, account_type FROM users WHERE email = ?', [email]))[0];
const tokenFor = async (userId) => (await createSession({ id: userId }, { client: 'test' })).tokens.access_token;

describe('approving a listing', () => {
    test('makes the account for its email, sends the set-password link, and gives it a page from the listing', async () => {
        ids.kate = await apply(`Kate Lash ${stamp}`);
        const sent = app.outbox.length;
        const res = await review(ids.kate, { status: 'approved' });
        assert.equal(res.status, 200, res.body.message);
        const account = await accountOf(emailOf('kate'));
        assert.deepEqual([account.account_type, account.professional_type, account.password], ['professional', 'individual', null]);
        assert.equal(res.body.data.user_id, account.id);
        ids.kateAccount = account.id;
        const mail = app.outbox.slice(sent).find((m) => m.to === emailOf('kate'));
        assert.match(mail.subject, /listing is live/);
        assert.match(mail.text, /\/reset-password\?token=/);

        const [{ slug }] = await q('SELECT slug FROM profile_pages WHERE user_id = ?', [account.id]);
        ids.kateSlug = slug;
        assert.equal(slug, `kate-lash-${stamp}`);
        const page = await app.request('GET', `/api/v1/profiles/${slug}`);
        assert.equal(page.status, 200, page.body.message);
        const p = page.body.data;
        assert.deepEqual([p.name, p.tagline, p.about, p.city, p.specialties], [`Kate Lash ${stamp}`, 'Lash Artist', 'Lash lifts and brow lamination in a calm studio.', 'Las Vegas', ['Lashes', 'Brows']]);
        assert.deepEqual([p.email, p.phone, p.access_card], [null, null, null], 'the applicant\'s own contact stays private');
        assert.equal(p.listing.locations[0].address, '9 Lash Ln');
        assert.deepEqual(p.listing.business_hours, ['Tue–Sat 10–6']);
        assert.equal(p.listing.gallery.length, 1);
        assert.deepEqual(p.social, [{ title: 'Instagram', url: 'https://instagram.com/lashes' }]);
    });

    test('the directory shows the account once, as a profile', async () => {
        const res = await app.request('GET', `/api/v1/directory/search?q=${encodeURIComponent(`Kate Lash ${stamp}`)}`);
        assert.deepEqual(res.body.data.rows.map((r) => [r.kind, r.slug]), [['profile', ids.kateSlug]]);
    });

    test('approving again sends nothing; an existing account is used, with a sign-in note when it has a password', async () => {
        const sent = app.outbox.length;
        await review(ids.kate, { status: 'approved' });
        assert.equal(app.outbox.length, sent, 'no second email');

        const existing = await insert("INSERT INTO users (email, role_id, account_type, status, is_active, password) VALUES (?, 6, 'user', 'ACCEPTED', 1, 'hash')", [emailOf('mia')]);
        await insert('INSERT INTO profiles (user_id, email, name) VALUES (?, ?, ?)', [existing, emailOf('mia'), 'Mia App']);
        const mia = await apply(`Mia Brows ${stamp}`);
        await review(mia, { status: 'approved' });
        const account = await accountOf(emailOf('mia'));
        assert.deepEqual([account.id, account.account_type], [existing, 'professional'], 'the app account became professional');
        const mail = app.outbox.slice(sent).find((m) => m.to === emailOf('mia'));
        assert.ok(!mail.text.includes('reset-password'));
        assert.match(mail.text, /\/login/);
    });

    test('a brand is named after its business, and so is its page, also when the email had an app account', async () => {
        const brand = await apply(`Bo Owner ${stamp}`);
        await review(brand, { status: 'approved', professional_type: 'brand' });
        const account = await accountOf(emailOf('bo'));
        assert.equal(account.professional_type, 'brand');
        const [{ name }] = await q('SELECT name FROM profiles WHERE user_id = ?', [account.id]);
        assert.equal(name, `Bo Owner ${stamp} Studio`);
        const [{ slug }] = await q('SELECT slug FROM profile_pages WHERE user_id = ?', [account.id]);
        assert.equal(slug, `bo-owner-${stamp}-studio`);
        ids.brandAccount = account.id;

        const appUser = await insert("INSERT INTO users (email, role_id, account_type, status, is_active, password) VALUES (?, 6, 'user', 'ACCEPTED', 1, 'hash')", [emailOf('lu')]);
        await insert('INSERT INTO profiles (user_id, email, name) VALUES (?, ?, ?)', [appUser, emailOf('lu'), 'Lu App']);
        await review(await apply(`Lu Maker ${stamp}`), { status: 'approved', professional_type: 'brand' });
        assert.equal((await accountOf(emailOf('lu'))).professional_type, 'brand');
        const [{ slug: luSlug }] = await q('SELECT slug FROM profile_pages WHERE user_id = ?', [appUser]);
        assert.equal(luSlug, `lu-maker-${stamp}-studio`);
        assert.equal((await app.request('GET', `/api/v1/profiles/${luSlug}`)).body.data.name, `Lu Maker ${stamp} Studio`);
    });
});

describe('the owner', () => {
    test('keeps the listing up to date from the dashboard; the email stays their sign-in', async () => {
        const token = await tokenFor(ids.kateAccount);
        const mine = await app.request('GET', '/api/v1/my/directory', { token });
        assert.equal(mine.status, 200, mine.body.message);
        assert.equal(mine.body.data.review_note, undefined);
        const res = await app.form('PUT', '/api/v1/my/directory', {
            fields: { bio: 'Now with brow tinting.', email: 'someone-else@example.com', remove_photos: [mine.body.data.gallery[0].url] },
            files: { images: [photo('two.png'), photo('three.png')] },
            token,
        });
        assert.equal(res.status, 200, res.body.message);
        assert.equal(res.body.data.bio, 'Now with brow tinting.');
        assert.equal(res.body.data.email, emailOf('kate'));
        assert.equal(res.body.data.gallery.length, 2);
        assert.equal((await app.request('GET', `/api/v1/profiles/${ids.kateSlug}`)).body.data.about, 'Now with brow tinting.');

        const someone = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active) VALUES (?, 7, 'professional', 'individual', 'ACCEPTED', 1)", [emailOf('nolisting')]);
        assert.equal((await app.request('GET', '/api/v1/my/directory', { token: await tokenFor(someone) })).body.code, 'NO_LISTING');
    });

    test('manages their own products, shown at once; a brand\'s are its own make', async () => {
        const token = await tokenFor(ids.kateAccount);
        const created = await app.form('POST', '/api/v1/my/products', {
            fields: { title: `Lash Serum ${stamp}`, price: '24.50', link: 'https://shop.example/serum', category: 'Serums' },
            files: { images: [photo('serum.png')] },
            token,
        });
        assert.equal(created.status, 201, created.body.message);
        const product = created.body.data;
        assert.deepEqual([product.status, product.owner.slug, product.brand_profile], ['published', ids.kateSlug, null]);
        assert.ok((await app.request('GET', `/api/v1/discover/shop?search=${encodeURIComponent(`Lash Serum ${stamp}`)}`)).body.data.rows.some((r) => r.id === product.id));
        assert.equal((await app.request('GET', `/api/v1/profiles/${ids.kateSlug}`)).body.data.products.count, 1);

        const edited = await app.request('PUT', `/api/v1/my/products/${product.id}`, { body: { price: '19.99', status: 'draft' }, token });
        assert.equal(edited.status, 200, edited.body.message);
        assert.deepEqual([edited.body.data.price, edited.body.data.status], ['19.99', 'draft']);
        assert.equal((await app.request('PUT', `/api/v1/my/products/${product.id}`, { body: { price: '1.234' }, token })).body.details.field, 'price');
        const stranger = await tokenFor(ids.brandAccount);
        assert.equal((await app.request('PUT', `/api/v1/my/products/${product.id}`, { body: { title: 'Mine now' }, token: stranger })).status, 404);
        assert.equal((await app.request('DELETE', `/api/v1/my/products/${product.id}`, { token })).status, 200);
        assert.equal((await app.request('GET', '/api/v1/my/products', { token })).body.data.count, 0);

        const brandProduct = await app.request('POST', '/api/v1/my/products', { body: { title: `Brand Balm ${stamp}` }, token: stranger });
        assert.equal(brandProduct.body.data.brand_id, ids.brandAccount);
    });
});

describe('admins', () => {
    test('edit any listing and add one for someone, which makes their account', async () => {
        const edited = await app.request('PUT', `/api/v1/directory/applications/${ids.kate}`, { body: { professional_title: 'Lash & Brow Artist' }, headers: auth });
        assert.equal(edited.status, 200, edited.body.message);
        assert.equal((await app.request('GET', `/api/v1/profiles/${ids.kateSlug}`)).body.data.tagline, 'Lash & Brow Artist');

        const sent = app.outbox.length;
        const added = await app.form('POST', '/api/v1/directory/applications/admin', {
            fields: { name: `Added By Admin ${stamp}`, email: emailOf('added'), locations: [{ location_type: 'service_area', city: 'Reno', state: 'NV', is_primary: true }] },
            headers: auth,
        });
        assert.equal(added.status, 201, added.body.message);
        assert.equal(added.body.data.status, 'approved');
        assert.ok(added.body.data.user_id);
        assert.ok(app.outbox.slice(sent).some((m) => m.to === emailOf('added')));
        assert.equal((await app.request('POST', '/api/v1/directory/applications/admin', { body: { name: 'x', email: emailOf('x') } })).status, 401);
    });
});
