// Plans, prices, discounts, personal prices and settings (website/access-card/catalog.js, docs/access.md 2 and 3).
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const { cardFields, cardFiles } = require('./cardFixtures');

let app, q, insert;
const tokens = {};
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (7, 'Professional', 'PRO')");
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Test Admin', ?, 1, 1)", [`admin-${stamp}@test.example`]);
    tokens.admin = jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' });
});
// Back to the seeded prices for the other test files.
after(async () => {
    await q("UPDATE access_products SET amount_cents = 499 WHERE code = 'pro'");
    await q("UPDATE access_products SET amount_cents = 3999 WHERE code = 'keychain'");
    await q('DELETE FROM access_discounts');
    await q('DELETE FROM access_price_overrides');
    await app.close();
});

const plans = async (options) => (await app.request('GET', '/api/v1/access/plans', options)).body.data;
const plan = (data, code) => data.plans.find((p) => p.code === code);
const asAdmin = (method, path, body) => app.request(method, `/api/v1${path}`, { token: tokens.admin, body });

describe('the plans as the website shows them', () => {
    test('four plans with today\'s prices, features and badge', async () => {
        const data = await plans();
        assert.deepEqual(data.plans.map((p) => p.code), ['free', 'nfc_only', 'subscription_only', 'nfc_with_subscription']);
        assert.equal(plan(data, 'free').due_today, 0);
        assert.equal(plan(data, 'nfc_only').due_today, 3999);
        assert.equal(plan(data, 'nfc_only').monthly, null);
        assert.equal(plan(data, 'subscription_only').due_today, 499);
        assert.equal(plan(data, 'subscription_only').monthly, 499);
        const both = plan(data, 'nfc_with_subscription');
        assert.equal(both.due_today, 4498);
        assert.equal(both.badge, 'Most popular');
        assert.deepEqual(both.includes, { subscription: true, keychain: true });
        assert.ok(both.features.some((f) => f.soon && f.text === 'Performance analytics'));
        assert.ok(both.features.some((f) => f.highlight === 'keychain'));
        assert.equal(data.sale, null);
        assert.deepEqual(data.owned, { subscription: false, keychain: false });
    });

    test('admin routes need an admin', async () => {
        assert.equal((await app.request('GET', '/api/v1/access/admin/catalog')).status, 401);
    });
});

describe('prices', () => {
    test('an admin changes a price: new checkouts get it, and the change is recorded', async () => {
        const res = await asAdmin('PUT', '/access/admin/products/pro/price', { amount_cents: 599 });
        assert.equal(res.status, 200, res.body.message);
        assert.equal(plan(await plans(), 'subscription_only').due_today, 599);
        const changes = (await asAdmin('GET', '/access/admin/price-changes')).body.data;
        assert.deepEqual([changes[0].product_code, changes[0].amount_before, changes[0].amount_after], ['pro', 499, 599]);
        assert.equal((await asAdmin('PUT', '/access/admin/products/pro/price', { amount_cents: 20 })).status, 400, 'Stripe\'s minimum is 50 cents');
        assert.equal((await asAdmin('PUT', '/access/admin/products/pro/price', { amount_cents: 4.99 })).status, 400, 'whole cents');
    });

    test('a site-wide discount shows on the plans; only one runs at a time', async () => {
        const res = await asAdmin('POST', '/access/admin/discounts', { name: 'Launch', percent_off: 20, applies_to: ['pro'], duration: 'repeating', duration_in_months: 3 });
        assert.equal(res.status, 200, res.body.message);
        const data = await plans();
        assert.equal(data.sale.name, 'Launch');
        const pro = plan(data, 'subscription_only');
        assert.equal(pro.due_today, 479, '20% off 599, the discount rounded to the cent');
        assert.equal(pro.monthly, 599, 'back to the list price after the three months');
        assert.equal(plan(data, 'nfc_only').due_today, 3999, 'the keychain is not in this sale');
        const clash = await asAdmin('POST', '/access/admin/discounts', { name: 'Other', amount_off_cents: 500, applies_to: ['keychain'] });
        assert.equal(clash.status, 409);
        assert.equal(clash.body.code, 'DISCOUNT_OVERLAPS');
        assert.equal((await asAdmin('POST', `/access/admin/discounts/${res.body.data.id}/end`)).status, 200);
        assert.equal((await plans()).sale, null);
    });

    test('an amount off the keychain, and a discount forever on Access Pro', async () => {
        const later = new Date(Date.now() + 1000);
        const keychain = await asAdmin('POST', '/access/admin/discounts', { name: 'Keychain $10 off', amount_off_cents: 1000, applies_to: ['keychain'], starts_at: later, ends_at: new Date(Date.now() + 3600e3) });
        assert.equal(keychain.status, 200, keychain.body.message);
        await new Promise((r) => setTimeout(r, 1100));
        assert.equal(plan(await plans(), 'nfc_only').due_today, 2999);
        await asAdmin('POST', `/access/admin/discounts/${keychain.body.data.id}/end`);
        const forever = await asAdmin('POST', '/access/admin/discounts', { name: 'Forever', percent_off: 50, applies_to: ['pro', 'keychain'], duration: 'forever' });
        assert.equal(forever.status, 200, forever.body.message);
        const both = plan(await plans(), 'nfc_with_subscription');
        assert.equal(both.due_today, 299 + 1999, 'half of 599 and of 3999, each discount rounded to the cent (300, 2000)');
        assert.equal(both.monthly, 299);
        await asAdmin('POST', `/access/admin/discounts/${forever.body.data.id}/end`);
    });

    test('checks what a discount takes off', async () => {
        assert.equal((await asAdmin('POST', '/access/admin/discounts', { name: 'X', percent_off: 120, applies_to: ['pro'] })).status, 400);
        assert.equal((await asAdmin('POST', '/access/admin/discounts', { name: 'X', percent_off: 10, amount_off_cents: 100, applies_to: ['pro'] })).status, 400);
        assert.equal((await asAdmin('POST', '/access/admin/discounts', { name: 'X', percent_off: 10, applies_to: ['gold'] })).status, 400);
    });
});

describe('a personal price', () => {
    test('for an email: a guest with that card sees it; it replaces the sale for that product', async () => {
        const email = `client-${stamp}@test.example`;
        const sale = await asAdmin('POST', '/access/admin/discounts', { name: 'Sale', percent_off: 10, applies_to: ['pro', 'keychain'] });
        const set = await asAdmin('POST', '/access/admin/custom-prices', { email, product_code: 'pro', amount_cents: 199, note: 'Founding member' });
        assert.equal(set.status, 200, set.body.message);
        const card = await app.form('POST', '/api/v1/businessCard', { fields: cardFields({ email }), files: cardFiles() });
        const { business_card_id: id, card_token: token } = card.body.data;

        const theirs = await plans({ headers: { 'x-card-token': token } });
        assert.equal(plan(theirs, 'subscription_only').due_today, 539, 'without the card id, the public sale price');
        const priced = (await app.request('GET', `/api/v1/access/plans?business_card_id=${id}`, { headers: { 'x-card-token': token } })).body.data;
        const pro = plan(priced, 'subscription_only').lines[0];
        assert.deepEqual([pro.amount, pro.recurring, pro.personal, pro.discount], [199, 199, true, null]);
        assert.equal(plan(priced, 'nfc_only').due_today, 3599, 'the sale still applies to the keychain');

        const again = await asAdmin('POST', '/access/admin/custom-prices', { email, product_code: 'pro', amount_cents: 299 });
        const list = (await asAdmin('GET', `/access/admin/custom-prices?email=${encodeURIComponent(email)}&active=true`)).body.data;
        assert.deepEqual(list.map((o) => o.amount_cents), [299], 'the newer price replaces the older');
        await asAdmin('POST', `/access/admin/custom-prices/${again.body.data.id}/end`);
        await asAdmin('POST', `/access/admin/discounts/${sale.body.data.id}/end`);
        const after = (await app.request('GET', `/api/v1/access/plans?business_card_id=${id}`, { headers: { 'x-card-token': token } })).body.data;
        assert.equal(plan(after, 'subscription_only').due_today, 599);
    });

    test('for a signed-in account, and what they own', async () => {
        const { createSession } = require('../src/shared/identity');
        const userId = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active, email_verified_at) VALUES (?, 7, 'professional', 'individual', 'ACCEPTED', 1, NOW())", [`member-${stamp}@test.example`]);
        await insert("INSERT INTO access_subscriptions (user_id, source, status) VALUES (?, 'comp', 'active')", [userId]);
        const token = (await createSession({ id: userId }, { client: 'test' })).tokens.access_token;
        await asAdmin('POST', '/access/admin/custom-prices', { user_id: userId, product_code: 'keychain', amount_cents: 1999 });
        const data = await plans({ token });
        assert.equal(plan(data, 'nfc_only').due_today, 1999);
        assert.deepEqual(data.owned, { subscription: true, keychain: false });
        assert.equal(plan(await plans(), 'nfc_only').due_today, 3999, 'nobody else gets it');
    });
});

describe('plans and settings', () => {
    test('an admin edits a plan', async () => {
        const res = await asAdmin('PUT', '/access/admin/plans/nfc_with_subscription', { badge: 'Best value', features: [{ text: 'Everything' }, { text: 'Later', soon: true }] });
        assert.equal(res.status, 200, res.body.message);
        const both = plan(await plans(), 'nfc_with_subscription');
        assert.equal(both.badge, 'Best value');
        assert.deepEqual(both.features, [{ text: 'Everything' }, { text: 'Later', soon: true }]);
        assert.equal((await asAdmin('PUT', '/access/admin/plans/free', { products: ['gold'] })).status, 400);
        assert.equal((await asAdmin('PUT', '/access/admin/plans/nope', { name: 'X' })).status, 404);
    });

    test('settings are checked and saved whole', async () => {
        const shipping = { mode: 'flat', flat_amount_cents: 500, countries: ['US', 'CA'], parcel: { length: 4, width: 4, height: 1, distance_unit: 'in', weight: 0.2, mass_unit: 'lb' } };
        const res = await asAdmin('PUT', '/access/admin/settings', { shipping });
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual(res.body.data.shipping, shipping);
        assert.equal((await asAdmin('PUT', '/access/admin/settings', { shipping: { ...shipping, countries: ['MX'] } })).status, 400);
        assert.equal((await asAdmin('PUT', '/access/admin/settings', { entitlements: { free: { photos: 4 } } })).status, 400);
        const catalog = (await asAdmin('GET', '/access/admin/catalog')).body.data;
        assert.equal(catalog.settings.shipping.mode, 'flat');
        assert.deepEqual(catalog.products.map((p) => p.code).sort(), ['keychain', 'pro', 'shipping']);
        await asAdmin('PUT', '/access/admin/settings', { shipping: { ...shipping, mode: 'live', flat_amount_cents: 0, countries: ['US'] } });
    });
});
