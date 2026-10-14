const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

let app;
const PASSWORD = 'Secret123';

// The token in the most recent email to this address (verify or reset link).
const linkToken = (to) => {
    const mail = [...app.outbox].reverse().find((m) => m.to === to);
    assert.ok(mail, `an email was sent to ${to}`);
    return new URL(mail.text.match(/https?:\/\/\S+token=\S+/)[0]).searchParams.get('token');
};
const post = (path, body, token) => app.request('POST', `/api/v1/user/auth${path}`, { body, token });
const unique = (name) => `${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.example`;

const register = (email, extra = {}) =>
    post('/register', { name: 'Test Person', email, password: PASSWORD, confirm_password: PASSWORD, client: 'website', ...extra });

const verifiedSignIn = async (email, extra) => {
    await register(email, extra);
    const res = await post('/verify-email', { token: linkToken(email), client: extra?.client || 'app' });
    assert.equal(res.status, 200);
    return res.body.data;
};

before(async () => {
    app = await startApp();
    await app.sequelize.query("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (6, 'User', 'USR'), (7, 'Professional', 'PRO'), (8, 'Brand', 'BRND')");
});
after(() => app.close());

describe('registration and verification', () => {
    test('website registration creates an unverified professional and emails a link to the website', async () => {
        const email = unique('reg');
        const res = await register(email.toUpperCase());
        assert.equal(res.status, 201);
        const [[user]] = await app.sequelize.query('SELECT email, account_type, professional_type, role_id, email_verified_at, password FROM users WHERE email = ?', { replacements: [email] });
        assert.equal(user.email, email, 'stored lowercase');
        assert.equal(user.account_type, 'professional');
        assert.equal(user.professional_type, 'individual');
        assert.equal(user.role_id, 7);
        assert.equal(user.email_verified_at, null);
        assert.ok(user.password.startsWith('$2'), 'password is hashed');
        const mail = app.outbox.at(-1);
        assert.match(mail.text, /https:\/\/glamlink\.net\/verify-email\?token=/);
    });

    test('signing in before verifying is refused and sends a new link', async () => {
        const email = unique('unverified');
        await register(email);
        const before = app.outbox.length;
        const res = await post('/login', { email, password: PASSWORD, client: 'website' });
        assert.equal(res.status, 403);
        assert.equal(res.body.code, 'EMAIL_NOT_VERIFIED');
        assert.equal(app.outbox.length, before + 1);
    });

    test('the verify link signs the person in, and works once', async () => {
        const email = unique('verify');
        await register(email);
        const token = linkToken(email);
        const res = await post('/verify-email', { token, client: 'website' });
        assert.equal(res.status, 200);
        assert.equal(res.body.data.user.email, email);
        assert.equal(res.body.data.user.email_verified, true);
        assert.ok(res.body.data.access_token);
        assert.match(res.headers.get('set-cookie'), /^glamlink_refresh=/, 'the website gets its refresh token as a cookie');
        const again = await post('/verify-email', { token, client: 'website' });
        assert.equal(again.status, 400);
        assert.equal(again.body.code, 'INVALID_LINK');
    });

    test('registering a verified email again is refused', async () => {
        const email = unique('dup');
        await verifiedSignIn(email);
        const res = await register(email);
        assert.equal(res.status, 409);
        assert.equal(res.body.code, 'EMAIL_TAKEN');
    });

    test('weak passwords are refused', async () => {
        const res = await post('/register', { name: 'X', email: unique('weak'), password: 'short', confirm_password: 'short' });
        assert.equal(res.status, 400);
        assert.equal(res.body.code, 'WEAK_PASSWORD');
    });
});

describe('sessions', () => {
    test('the access token opens protected routes; signing out closes them', async () => {
        const { access_token } = await verifiedSignIn(unique('session'));
        const profile = await app.request('GET', '/api/v1/user/profile', { token: access_token });
        assert.equal(profile.status, 200);
        const out = await post('/logout', {}, access_token);
        assert.equal(out.status, 200);
        const after = await app.request('GET', '/api/v1/user/profile', { token: access_token });
        assert.equal(after.status, 401);
        assert.equal(after.body.code, 'SESSION_EXPIRED');
    });

    test('a forged or admin-style token is refused', async () => {
        const res = await app.request('GET', '/api/v1/user/profile', { token: 'not-a-token' });
        assert.equal(res.status, 401);
    });

    test('a user token does not open admin routes', async () => {
        const { access_token } = await verifiedSignIn(unique('notadmin'));
        const res = await app.request('GET', '/api/v1/admin/permissions', { token: access_token });
        assert.ok(res.status === 401 || res.status === 403, `got ${res.status}`);
    });

    test('refresh rotates the refresh token', async () => {
        const { refresh_token } = await verifiedSignIn(unique('refresh'));
        const res = await post('/refresh', { refresh_token });
        assert.equal(res.status, 200);
        assert.notEqual(res.body.data.refresh_token, refresh_token);
        const next = await post('/refresh', { refresh_token: res.body.data.refresh_token });
        assert.equal(next.status, 200);
    });

    test('an old refresh token used right after rotation gets "use the newest one", not a sign-out', async () => {
        const { refresh_token } = await verifiedSignIn(unique('race'));
        const first = await post('/refresh', { refresh_token });
        const second = await post('/refresh', { refresh_token });
        assert.equal(second.status, 409);
        assert.equal(second.body.code, 'REFRESH_TOKEN_ROTATED');
        const still = await post('/refresh', { refresh_token: first.body.data.refresh_token });
        assert.equal(still.status, 200);
    });

    test('a replayed refresh token revokes the session', async () => {
        const { refresh_token } = await verifiedSignIn(unique('replay'));
        const first = await post('/refresh', { refresh_token });
        // Pretend the rotation happened a while ago, past the grace period.
        await app.sequelize.query('UPDATE auth_sessions SET rotated_at = NOW() - INTERVAL 5 MINUTE WHERE previous_token_hash IS NOT NULL');
        const replay = await post('/refresh', { refresh_token });
        assert.equal(replay.status, 401);
        const legit = await post('/refresh', { refresh_token: first.body.data.refresh_token });
        assert.equal(legit.status, 401, 'the whole session is gone');
    });

    test('the website gets its refresh token as an httpOnly cookie, not in the body', async () => {
        const email = unique('cookie');
        await verifiedSignIn(email);
        const res = await post('/login', { email, password: PASSWORD, client: 'website' });
        assert.equal(res.status, 200);
        assert.equal(res.body.data.refresh_token, undefined);
        const cookie = res.headers.get('set-cookie');
        assert.match(cookie, /^glamlink_refresh=[^;]+;/);
        assert.match(cookie, /HttpOnly/);
        assert.match(cookie, /Path=\/api\/v1\/user\/auth/);
        assert.match(cookie, /SameSite=Lax/);
        const value = cookie.split(';')[0];
        const refreshed = await app.request('POST', '/api/v1/user/auth/refresh', { body: {}, headers: { Cookie: value } });
        assert.equal(refreshed.status, 200);
        assert.ok(refreshed.body.data.access_token);
        assert.equal(refreshed.body.data.refresh_token, undefined);
        assert.notEqual(refreshed.headers.get('set-cookie').split(';')[0], value, 'the cookie rotates');
        const out = await post('/logout', {}, refreshed.body.data.access_token);
        assert.match(out.headers.get('set-cookie'), /glamlink_refresh=;/);
    });

    test('the app gets its refresh token in the body', async () => {
        const email = unique('appbody');
        await verifiedSignIn(email);
        const res = await post('/login', { email, password: PASSWORD, client: 'app' });
        assert.ok(res.body.data.refresh_token);
        assert.equal(res.headers.get('set-cookie'), null);
    });

    test('the website signs in professionals only; the app signs in users', async () => {
        const email = unique('appuser');
        await post('/register', { name: 'App User', email, password: PASSWORD, confirm_password: PASSWORD, client: 'app', account_type: 'user' });
        await post('/verify-email', { token: linkToken(email), client: 'app' });
        const web = await post('/login', { email, password: PASSWORD, client: 'website' });
        assert.equal(web.status, 403);
        assert.equal(web.body.code, 'PROFESSIONAL_REQUIRED');
        const appLogin = await post('/login', { email, password: PASSWORD, client: 'app' });
        assert.equal(appLogin.status, 200);
        assert.equal(appLogin.body.data.user.account_type, 'user');
    });

    test('a wrong password is refused without saying which part was wrong', async () => {
        const email = unique('wrongpw');
        await verifiedSignIn(email);
        const res = await post('/login', { email, password: 'Wrong999x', client: 'website' });
        assert.equal(res.status, 401);
        assert.equal(res.body.code, 'INVALID_CREDENTIALS');
        const nobody = await post('/login', { email: unique('nobody'), password: PASSWORD, client: 'website' });
        assert.equal(nobody.status, 401);
        assert.equal(nobody.body.code, 'INVALID_CREDENTIALS');
    });
});

describe('route guards', () => {
    test('routes that need a person refuse guests with 401 SIGN_IN_REQUIRED', async () => {
        for (const [method, path] of [['GET', '/api/v1/user/followers'], ['GET', '/api/v1/case/attachments/1'], ['POST', '/api/v1/post/comment']]) {
            const res = await app.request(method, path, method === 'GET' ? {} : { body: {} });
            assert.equal(res.status, 401, `${method} ${path}`);
            assert.equal(res.body.code, 'SIGN_IN_REQUIRED');
        }
    });

    test('public pages stay open to guests', async () => {
        assert.equal((await app.request('GET', '/api/v1/user/list/timezones')).status, 200);
        assert.equal((await app.request('GET', '/api/v1/businessCard/getAllProfiles')).status, 200);
    });

    test('Access card owner routes need a professional account', async () => {
        const email = unique('guarduser');
        await post('/register', { name: 'App User', email, password: PASSWORD, confirm_password: PASSWORD, client: 'app', account_type: 'user' });
        const { access_token } = (await post('/verify-email', { token: linkToken(email), client: 'app' })).body.data;
        const asUser = await app.request('GET', '/api/v1/businessCard/getMyBusinessCard', { token: access_token });
        assert.equal(asUser.status, 403);
        assert.equal(asUser.body.code, 'PROFESSIONAL_REQUIRED');
        const pro = await verifiedSignIn(unique('guardpro'));
        const asPro = await app.request('GET', '/api/v1/businessCard/getMyBusinessCard', { token: pro.access_token });
        assert.notEqual(asPro.status, 403);
        assert.notEqual(asPro.status, 401);
    });

    test('the access token also works as "Authorization: Bearer"', async () => {
        const { access_token } = await verifiedSignIn(unique('bearer'));
        const res = await app.request('GET', '/api/v1/user/profile', { headers: { Authorization: `Bearer ${access_token}` } });
        assert.equal(res.status, 200);
    });
});

describe('passwords', () => {
    test('forgot and reset: the link sets a new password and signs out every device', async () => {
        const email = unique('reset');
        const { access_token } = await verifiedSignIn(email);
        const forgot = await post('/forgot-password', { email });
        assert.equal(forgot.status, 200);
        const token = linkToken(email);
        assert.match(app.outbox.at(-1).text, /https:\/\/glamlink\.net\/reset-password\?token=/);
        const reset = await post('/reset-password', { token, password: 'NewSecret456', confirm_password: 'NewSecret456' });
        assert.equal(reset.status, 200);
        assert.equal((await app.request('GET', '/api/v1/user/profile', { token: access_token })).status, 401);
        assert.equal((await post('/login', { email, password: PASSWORD, client: 'website' })).status, 401);
        assert.equal((await post('/login', { email, password: 'NewSecret456', client: 'website' })).status, 200);
        assert.equal((await post('/reset-password', { token, password: 'Another789x', confirm_password: 'Another789x' })).status, 400);
    });

    test('forgot password answers the same for unknown emails and sends nothing', async () => {
        const before = app.outbox.length;
        const res = await post('/forgot-password', { email: unique('ghost') });
        assert.equal(res.status, 200);
        assert.equal(app.outbox.length, before);
    });

    test('changing the password keeps this device and signs out the others', async () => {
        const email = unique('change');
        const first = await verifiedSignIn(email);
        const second = (await post('/login', { email, password: PASSWORD, client: 'website' })).body.data;
        const res = await post('/change-password', { old_password: PASSWORD, new_password: 'Changed123', confirm_password: 'Changed123' }, second.access_token);
        assert.equal(res.status, 200);
        assert.equal((await app.request('GET', '/api/v1/user/profile', { token: second.access_token })).status, 200);
        assert.equal((await app.request('GET', '/api/v1/user/profile', { token: first.access_token })).status, 401);
    });
});

describe('Access card accounts', () => {
    test('a card bought by email creates a professional with no password; the welcome link sets it and verifies', async () => {
        const { accessCardOwner, setPasswordLink } = require('../src/modules/identity/account.service');
        const email = unique('card');
        const { user, created } = await accessCardOwner({ email, name: 'Card Owner', phone: '555' });
        assert.equal(created, true);
        assert.equal(user.account_type, 'professional');
        assert.equal(user.password, null);
        const login = await post('/login', { email, password: PASSWORD, client: 'website' });
        assert.equal(login.body.code, 'PASSWORD_NOT_SET');
        const token = new URL(await setPasswordLink(user)).searchParams.get('token');
        assert.equal((await post('/reset-password', { token, password: PASSWORD, confirm_password: PASSWORD })).status, 200);
        const res = await post('/login', { email, password: PASSWORD, client: 'website' });
        assert.equal(res.status, 200);
        assert.equal(res.body.data.user.email_verified, true);
    });

    test('a card bought with a user account email switches that account to professional', async () => {
        const { accessCardOwner } = require('../src/modules/identity/account.service');
        const email = unique('switch');
        await post('/register', { name: 'App User', email, password: PASSWORD, confirm_password: PASSWORD, client: 'app', account_type: 'user' });
        const { user, created } = await accessCardOwner({ email, name: 'App User' });
        assert.equal(created, false);
        await user.reload();
        assert.equal(user.account_type, 'professional');
        assert.equal(user.role_id, 7);
    });
});
