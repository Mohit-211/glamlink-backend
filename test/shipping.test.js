// Shipping the keychain with Shippo (shared/users/shippingAddress.js; website/access-card shipping.js,
// fulfillment.js; docs/access.md section 7), with Shippo faked.
process.env.SHIP_FROM_NAME = 'Glamlink Warehouse';
process.env.SHIP_FROM_STREET1 = '100 Test Way';
process.env.SHIP_FROM_CITY = 'Las Vegas';
process.env.SHIP_FROM_STATE = 'NV';
process.env.SHIP_FROM_ZIP = '89101';
process.env.SHIPPO_WEBHOOK_TOKEN = 'shippo-test-token';
process.env.SHIPPO_WEBHOOK_HMAC_SECRET = 'shippo-hmac-secret';
const crypto = require('crypto');
const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');
const { cardFields, cardFiles } = require('./cardFixtures');

let app, q, insert, shippo;
const tokens = {};
const calls = [];
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const LIVE = { mode: 'live', flat_amount_cents: 0, countries: ['US'], parcel: { length: 4, width: 4, height: 1, distance_unit: 'in', weight: 0.2, mass_unit: 'lb' } };

// What the fake Shippo answers next.
const next = {};

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    shippo = require('../src/integrations/shippoApi');
    shippo.validateAddress = async (address) => {
        calls.push(['validateAddress', address]);
        if (next.validate === 'down') throw new shippo.ShippoError('Shippo is down', { status: 503 });
        if (next.validate === 'invalid') return { result: 'invalid', address: null, reasons: [{ code: 'address_not_found', message: 'The address could not be found' }], residential: null };
        return { result: 'partially_valid', address: { ...address, street1: address.street1.toUpperCase(), zip: `${address.zip}-1234` }, reasons: [], residential: true, latitude: 36.1, longitude: -115.1, shippo_address_id: null };
    };
    shippo.getRates = async (args) => {
        calls.push(['getRates', args]);
        return {
            shipment_id: 'shp_1',
            rates: [
                { rate_id: 'rate_cheap', amount_cents: 450, currency: 'usd', provider: 'USPS', service: 'Ground Advantage', estimated_days: 4 },
                { rate_id: 'rate_fast', amount_cents: 1200, currency: 'usd', provider: 'UPS', service: '2nd Day Air', estimated_days: 2 },
            ],
            messages: [],
        };
    };
    shippo.customsDeclaration = async (args) => {
        calls.push(['customsDeclaration', args]);
        return { object_id: 'cd_1' };
    };
    shippo.buyLabel = async ({ rateId }) => {
        calls.push(['buyLabel', rateId]);
        if (rateId === 'rate_expired') return { status: 'ERROR', messages: ['Rate expired'] };
        return { transaction_id: `tr_${rateId}`, status: 'SUCCESS', tracking_number: `TRACK_${rateId}`, tracking_url: 'https://track.example/1', label_url: 'https://labels.example/1.pdf', messages: [] };
    };
    shippo.refundLabel = async (transactionId) => {
        calls.push(['refundLabel', transactionId]);
        return { refund_id: 'rf_1', status: 'QUEUED' };
    };
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (7, 'Professional', 'PRO')");
    await q("INSERT IGNORE INTO countries (id, name, iso2, iso3) VALUES (233, 'United States', 'US', 'USA'), (39, 'Canada', 'CA', 'CAN')");
    await q("INSERT IGNORE INTO states (id, name, country_id, country_code, iso2) VALUES (9001, 'Nevada', 233, 'US', 'NV'), (9002, 'Ontario', 39, 'CA', 'ON')");
    await q("INSERT IGNORE INTO cities (id, name, state_id, state_code, country_id, country_code, latitude, longitude) VALUES (9001, 'Las Vegas', 9001, 'NV', 233, 'US', 36.17, -115.14), (9002, 'Toronto', 9002, 'ON', 39, 'CA', 43.65, -79.38)");
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Test Admin', ?, 1, 1)", [`admin-${stamp}@test.example`]);
    tokens.admin = jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' });
    await q("UPDATE access_settings SET value = ? WHERE setting = 'shipping'", [JSON.stringify(LIVE)]);
});
after(async () => {
    await q("UPDATE access_settings SET value = ? WHERE setting = 'shipping'", [JSON.stringify(LIVE)]);
    await app.close();
});

const guestCard = async () => {
    const res = await app.form('POST', '/api/v1/businessCard', { fields: cardFields({ email: `ship-${stamp}-${Math.floor(Math.random() * 1e9)}@test.example` }), files: cardFiles() });
    return res.body.data;
};
const NV = { address_line_1: '1 Main St', state_id: 9001, city_id: 9001, postal_code: '89101' };
const row = async (sql, args) => (await q(sql, args))[0];

describe('the delivery address', () => {
    test('is checked with Shippo and saved as Shippo corrected it', async () => {
        const card = await guestCard();
        const res = await app.request('POST', '/api/v1/order/addNewAddress-public', {
            body: { ...NV, business_card_id: card.business_card_id, address_line_2: 'Suite 5', recipient_name: 'Jane Smith' },
            headers: { 'x-card-token': card.card_token },
        });
        assert.equal(res.status, 201, res.body.message);
        assert.equal(res.body.data.corrected, true);
        assert.equal(res.body.data.original_address.zip, '89101');
        const saved = await row('SELECT address_line_1, address_line_2, postal_code, purpose, address_type, validation_result, recipient_name FROM user_address WHERE id = ?', [res.body.data.address_id]);
        assert.deepEqual(saved, { address_line_1: '1 MAIN ST', address_line_2: 'Suite 5', postal_code: '89101-1234', purpose: 'shipping', address_type: 'residential', validation_result: 'partially_valid', recipient_name: 'Jane Smith' });
        const [, sent] = calls.filter((c) => c[0] === 'validateAddress').at(-1);
        assert.deepEqual([sent.street2, sent.city, sent.state, sent.country, sent.name], ['Suite 5', 'Las Vegas', 'NV', 'US', 'Jane Smith']);
    });

    test('an address Shippo cannot deliver to is refused with the message the website shows', async () => {
        const card = await guestCard();
        next.validate = 'invalid';
        const res = await app.request('POST', '/api/v1/order/addNewAddress-public', { body: { ...NV, business_card_id: card.business_card_id }, headers: { 'x-card-token': card.card_token } });
        next.validate = null;
        assert.equal(res.status, 400);
        assert.equal(res.body.code, 'ADDRESS_INVALID');
        assert.equal(res.body.message, 'Address validation failed: The address could not be found');
    });

    test('when Shippo is down the address is not saved unchecked', async () => {
        const card = await guestCard();
        next.validate = 'down';
        const res = await app.request('POST', '/api/v1/order/addNewAddress-public', { body: { ...NV, business_card_id: card.business_card_id }, headers: { 'x-card-token': card.card_token } });
        next.validate = null;
        assert.equal(res.status, 502);
        assert.equal(res.body.code, 'ADDRESS_CHECK_UNAVAILABLE');
    });

    test('signed in: saved and returned; another person\'s address cannot be edited; a shipping address is not a business address', async () => {
        const { createSession } = require('../src/shared/identity');
        const make = async (name) => {
            const id = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active, email_verified_at) VALUES (?, 7, 'professional', 'individual', 'ACCEPTED', 1, NOW())", [`${name}-${stamp}@test.example`]);
            return { id, token: (await createSession({ id }, { client: 'test' })).tokens.access_token };
        };
        const owner = await make('addr-owner');
        const other = await make('addr-other');
        const added = await app.request('POST', '/api/v1/order/addNewAddress', { token: owner.token, body: NV });
        assert.equal(added.status, 201, added.body.message);
        const addressId = added.body.data.id;
        const stolen = await app.request('PUT', `/api/v1/order/editAddress/${addressId}`, { token: other.token, body: { address_line_1: '9 Elsewhere Rd' } });
        assert.equal(stolen.status, 400, 'it used to edit any address by id');
        const own = await app.request('PUT', `/api/v1/order/editAddress/${addressId}`, { token: owner.token, body: { address_line_1: '2 Main St' } });
        assert.equal(own.status, 201, own.body.message);
        const asBusiness = await app.request('GET', `/api/v1/order/getBuinessAddressById/${addressId}`);
        assert.ok(!asBusiness.body.data?.id, 'a delivery address is not served publicly');
    });
});

describe('shipping options at checkout', () => {
    const quoteFor = async (stateId, cityId, countries = ['US']) => {
        await q("UPDATE access_settings SET value = ? WHERE setting = 'shipping'", [JSON.stringify({ ...LIVE, countries })]);
        const card = await guestCard();
        await app.request('POST', '/api/v1/order/addNewAddress-public', {
            body: { address_line_1: '1 Main St', state_id: stateId, city_id: cityId, postal_code: 'M5V 2T6', business_card_id: card.business_card_id },
            headers: { 'x-card-token': card.card_token },
        });
        return { card, res: await app.request('POST', '/api/v1/access/checkout/quote', { body: { business_card_id: card.business_card_id, plan_type: 'nfc_only' }, headers: { 'x-card-token': card.card_token } }) };
    };

    test('live Shippo rates from the warehouse, cheapest first; rate_id picks another', async () => {
        const { card, res } = await quoteFor(9001, 9001);
        assert.equal(res.status, 200, res.body.message);
        assert.deepEqual(res.body.data.shipping.options.map((o) => o.rate_id), ['rate_cheap', 'rate_fast']);
        assert.equal(res.body.data.shipping_cents, 450);
        const [, args] = calls.filter((c) => c[0] === 'getRates').at(-1);
        assert.equal(args.from.street1, '100 Test Way');
        assert.equal(args.parcel.weight, '0.2');
        const faster = await app.request('POST', '/api/v1/access/checkout/quote', { body: { business_card_id: card.business_card_id, plan_type: 'nfc_only', rate_id: 'rate_fast' }, headers: { 'x-card-token': card.card_token } });
        assert.equal(faster.body.data.shipping_cents, 1200);
        assert.equal(faster.body.data.checkout_id, res.body.data.checkout_id, 'the same open checkout');
    });

    test('Canada: refused until switched on, then with a customs declaration', async () => {
        const refused = await quoteFor(9002, 9002);
        assert.equal(refused.res.body.code, 'SHIPPING_COUNTRY_UNSUPPORTED');
        const allowed = await quoteFor(9002, 9002, ['US', 'CA']);
        assert.equal(allowed.res.status, 200, allowed.res.body.message);
        const [, declared] = calls.filter((c) => c[0] === 'customsDeclaration').at(-1);
        assert.equal(declared.valueCents, 3999);
        assert.equal(calls.filter((c) => c[0] === 'getRates').at(-1)[1].customsDeclarationId, 'cd_1');
    });
});

describe('the label and tracking', () => {
    let orderId;
    const order = (id) => row('SELECT fulfillment_status, tracking_number, label_url, shippo_rate_id, carrier, shipped_at, delivered_at, tracking_status FROM access_orders WHERE id = ?', [id]);
    const makeOrder = async (rateId) => {
        const email = `order-${stamp}-${rateId}@test.example`;
        const cardId = await insert("INSERT INTO business_cards (name, email, status, is_active) VALUES ('Order Test', ?, 'accepted', 1)", [email]);
        const paymentId = await insert("INSERT INTO payments (transaction_id, amount, stripe_customer_id, payment_status, payment_type) VALUES (?, 44.99, 'cus_test', 'SUCCESS', 'NFC_ONLY')", [`pi_${stamp}_${rateId}`]);
        return insert(
            `INSERT INTO access_orders (order_number, business_card_id, payment_id, customer_name, customer_email, amount_paid, payment_status, recipient_name, shipping_address_line_1, shipping_city, shipping_state, shipping_postal_code, shipping_country, fulfillment_status, shippo_rate_id, carrier, service)
             VALUES (?, ?, ?, 'Jane Smith', ?, 44.99, 'paid', 'Jane Smith', '1 Main St', 'Las Vegas', 'NV', '89101', 'US', 'pending', ?, 'USPS', 'Ground Advantage')`,
            [`GL-TEST-${stamp}-${rateId}`, cardId, paymentId, email, rateId],
        );
    };
    const asAdmin = (method, path, body) => app.request(method, `/api/v1/businessCard/access-orders/${path}`, { token: tokens.admin, body });

    test('an admin buys the label with the rate chosen at checkout; one label at a time; voiding it', async () => {
        orderId = await makeOrder('rate_cheap');
        assert.equal((await app.request('POST', `/api/v1/businessCard/access-orders/${orderId}/label`)).status, 401);
        const bought = await asAdmin('POST', `${orderId}/label`);
        assert.equal(bought.status, 200, bought.body.message);
        assert.deepEqual(await order(orderId), {
            fulfillment_status: 'processing', tracking_number: 'TRACK_rate_cheap', label_url: 'https://labels.example/1.pdf',
            shippo_rate_id: 'rate_cheap', carrier: 'USPS', shipped_at: null, delivered_at: null, tracking_status: null,
        });
        assert.equal((await asAdmin('POST', `${orderId}/label`)).body.code, 'LABEL_EXISTS');
        const voided = await asAdmin('POST', `${orderId}/label/void`);
        assert.equal(voided.status, 200, voided.body.message);
        assert.deepEqual(calls.filter((c) => c[0] === 'refundLabel').at(-1), ['refundLabel', 'tr_rate_cheap']);
        assert.equal((await order(orderId)).fulfillment_status, 'pending');
    });

    test('an expired checkout rate: today\'s rate for the same service is bought', async () => {
        const expired = await makeOrder('rate_expired');
        const bought = await asAdmin('POST', `${expired}/label`);
        assert.equal(bought.status, 200, bought.body.message);
        assert.equal((await order(expired)).shippo_rate_id, 'rate_cheap');
        const rates = await asAdmin('GET', `${expired}/rates`);
        assert.equal(rates.body.data.rates.length, 2);
    });

    test('Shippo\'s tracking moves the order to shipped and delivered; unverified calls are refused', async () => {
        const id = await makeOrder('rate_fast');
        await asAdmin('POST', `${id}/label`);
        const send = (status, { token = 'shippo-test-token', secret = 'shippo-hmac-secret' } = {}) => {
            const body = JSON.stringify({ event: 'track_updated', test: true, data: { tracking_number: 'TRACK_rate_fast', carrier: 'ups', tracking_status: { status, status_details: `now ${status}`, status_date: new Date().toISOString() } } });
            const t = Math.floor(Date.now() / 1000);
            const v1 = crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
            return fetch(`${app.base}/api/v1/access/shippo/webhook?token=${token}`, { method: 'POST', body, headers: { 'Content-Type': 'application/json', 'Shippo-Auth-Signature': `t=${t},v1=${v1}` } });
        };
        assert.equal((await send('TRANSIT', { token: 'wrong' })).status, 401);
        assert.equal((await send('TRANSIT', { secret: 'wrong' })).status, 401);
        assert.equal((await send('TRANSIT')).status, 200);
        let o = await order(id);
        assert.deepEqual([o.fulfillment_status, o.tracking_status, Boolean(o.shipped_at)], ['shipped', 'TRANSIT', true]);
        await send('DELIVERED');
        o = await order(id);
        assert.deepEqual([o.fulfillment_status, Boolean(o.delivered_at)], ['delivered', true]);
        await send('TRANSIT');
        assert.equal((await order(id)).fulfillment_status, 'delivered', 'never backwards');
    });
});
