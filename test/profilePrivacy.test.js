// GET /user/profile/:userId shows the public profile to guests and other accounts; only the owner and admins get
// the account's private fields (shared/users/userPublic.js).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');

let app, proId;
const tokens = {};
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
// Private values planted in the account, its profile, its address and its reviewer: none may reach the public.
const secrets = {
    email: `private-pro-${stamp}@test.example`,
    stripe: `cus_secret${stamp}`,
    socket: `socket-${stamp}`,
    fcm: `fcm-${stamp}`,
    referral: `REF${stamp}`,
    mobile: '7025550199',
    address: `${stamp} Hidden Street`,
    reviewerEmail: `reviewer-${stamp}@test.example`,
    reviewerMobile: '2125550123',
    reviewerAddress: `${stamp} Reviewer Road`,
};

before(async () => {
    app = await startApp();
    const q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    const insert = async (sql, replacements) => { const res = await q(sql, replacements); return res.insertId ?? res; };
    const { createSession } = require('../src/shared/identity');
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (6, 'User', 'USR'), (7, 'Professional', 'PRO')");

    proId = await insert(
        `INSERT INTO users (email, role_id, account_type, professional_type, status, is_active, email_verified_at, stripe_customer_id,
            socket_id, fcm_token, referral_code, latitude, longitude)
         VALUES (?, 7, 'professional', 'individual', 'ACCEPTED', 1, NOW(), ?, ?, ?, ?, 36.17, -115.14)`,
        [secrets.email, secrets.stripe, secrets.socket, secrets.fcm, secrets.referral],
    );
    await insert(
        "INSERT INTO profiles (user_id, email, name, about, profession, mobile, address) VALUES (?, ?, 'Private Pro', 'Lash artist', 'Esthetician', ?, ?)",
        [proId, secrets.email, secrets.mobile, secrets.address],
    );
    await insert(
        "INSERT INTO user_address (user_id, role_id, address_line_1, province_code, postal_code, is_active) VALUES (?, 7, ?, 'NV', '89101', 1)",
        [proId, secrets.address],
    );
    const reviewer = await insert(
        "INSERT INTO users (email, role_id, account_type, status, is_active, email_verified_at, latitude, longitude) VALUES (?, 6, 'user', 'ACCEPTED', 1, NOW(), 40.71, -74.01)",
        [secrets.reviewerEmail],
    );
    await insert("INSERT INTO profiles (user_id, email, name, mobile, address) VALUES (?, ?, 'Reviewer Rae', ?, ?)", [reviewer, secrets.reviewerEmail, secrets.reviewerMobile, secrets.reviewerAddress]);
    await insert("INSERT INTO reviews (id, text, professional_id, user_id, level) VALUES (?, 'Lovely work', ?, ?, '5')", [crypto.randomUUID(), proId, reviewer]);

    const stranger = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active, email_verified_at) VALUES (?, 7, 'professional', 'individual', 'ACCEPTED', 1, NOW())", [`stranger-${stamp}@test.example`]);
    tokens.stranger = (await createSession({ id: stranger }, { client: 'test' })).tokens.access_token;
    tokens.owner = (await createSession({ id: proId }, { client: 'test' })).tokens.access_token;
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Profile Admin', ?, 1, 1)", [`profile-admin-${stamp}@test.example`]);
    tokens.admin = jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' });
});
after(() => app.close());

const profile = (headers = {}) => app.request('GET', `/api/v1/user/profile/${proId}`, { headers });

const assertPublic = (res) => {
    assert.equal(res.status, 200, res.body.message);
    const { data } = res.body;
    assert.equal(data.id, proId);
    assert.equal(data.user_profile.name, 'Private Pro');
    assert.equal(data.user_profile.about, 'Lash artist');
    assert.equal(data.reviews[0].reviewed_by.user_profile.name, 'Reviewer Rae');
    for (const field of ['email', 'stripe_customer_id', 'socket_id', 'fcm_token', 'referral_code', 'latitude', 'longitude', 'user_address']) {
        assert.equal(data[field], undefined, `${field} is not public`);
    }
    for (const field of ['mobile', 'dialing_code', 'address', 'user_coin_balances']) assert.equal(data.user_profile[field], undefined, `user_profile.${field} is not public`);
    assert.equal(data.reviews[0].reviewed_by.latitude, undefined);
    const text = JSON.stringify(res.body);
    for (const [name, value] of Object.entries(secrets)) assert.ok(!text.includes(value), `${name} appears nowhere`);
};

test('a guest sees the public profile only', async () => {
    assertPublic(await profile());
});

test('another signed-in account sees the public profile only', async () => {
    const res = await profile({ Authorization: `Bearer ${tokens.stranger}` });
    assertPublic(res);
    assert.equal(res.body.data.is_follow, false);
});

test('the owner sees their whole account', async () => {
    const res = await profile({ Authorization: `Bearer ${tokens.owner}` });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.email, secrets.email);
    assert.equal(res.body.data.user_profile.mobile, secrets.mobile);
});

test('an admin sees the whole account', async () => {
    const res = await profile({ Authorization: `Bearer ${tokens.admin}` });
    assert.equal(res.status, 200, res.body.message);
    assert.equal(res.body.data.email, secrets.email);
    assert.equal(res.body.data.is_follow, false);
});

test('a bad token is still refused', async () => {
    const res = await profile({ Authorization: 'Bearer not-a-token' });
    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'SESSION_EXPIRED');
});
