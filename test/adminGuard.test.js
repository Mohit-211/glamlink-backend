// One admin guard (requireAdmin) on every admin route, the app's admin screens included; no sign-in for
// deactivated admins; one answer for every failed sign-in; signing out or a new password ends the sessions.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { startApp } = require('./helpers');

let app, q;
const admins = {};
const PASSWORD = 'AdminPass123';
const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const tokenFor = (id, options = { expiresIn: '1h' }) => jwt.sign({ id, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', ...options });
const login = (email, password = PASSWORD) => app.request('POST', '/api/v1/admin/auth/login', { body: { email, password } });

before(async () => {
    app = await startApp();
    q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (2, 'Admin', 'ADM')");
    const hash = await bcrypt.hash(PASSWORD, 8);
    for (const [key, active] of [['active', 1], ['deactivated', 0], ['sessions', 1], ['password', 1]]) {
        const email = `${key}-${stamp}@test.example`;
        const res = await q('INSERT INTO admins (name, email, password, role_id, is_active) VALUES (?, ?, ?, 1, ?)', [key, email, hash, active]);
        admins[key] = { id: res.insertId ?? res, email, token: tokenFor(res.insertId ?? res) };
    }
});
after(() => app.close());

test('one answer for a deactivated admin, an unknown email and a wrong password', async () => {
    const ok = await login(admins.active.email);
    assert.equal(ok.status, 200);
    assert.ok(ok.body.data.token);
    for (const res of [await login(admins.deactivated.email), await login(`nobody-${stamp}@test.example`), await login(admins.active.email, 'WrongPass999')]) {
        assert.equal(res.status, 401);
        assert.equal(res.body.code, 'INVALID_CREDENTIALS');
        assert.equal(res.body.message, 'Invalid email or password.');
    }
});

test("a deactivated admin's token is refused on routes that used the old check", async () => {
    for (const [method, path] of [['POST', '/api/v1/blog'], ['PUT', '/api/v1/blog/update/1'], ['POST', '/api/v1/blog/delete'], ['POST', '/api/v1/blog-category'],
        ['POST', '/api/v1/profession'], ['PUT', '/api/v1/profession/1'], ['POST', '/api/v1/profession/delete'], ['POST', '/api/v1/admin/auth/change-password']]) {
        const res = await app.request(method, path, { body: {}, token: admins.deactivated.token });
        assert.equal(res.status, 401, `${method} ${path}`);
    }
});

test('admin routes accept the token as Authorization: Bearer as well as x-access-token', async () => {
    const bearer = await app.request('GET', '/api/v1/admin/list', { headers: { Authorization: `Bearer ${admins.active.token}` } });
    assert.equal(bearer.status, 200);
    const header = await app.request('GET', '/api/v1/admin/list', { token: admins.active.token });
    assert.equal(header.status, 200);
});

test("the app's admin screens use the same check: 401 for a deactivated admin or an expired token, never 500", async () => {
    assert.equal((await app.request('GET', '/api/v1/admin/posts', { token: admins.active.token })).status, 200);
    assert.equal((await app.request('GET', '/api/v1/admin/posts', { headers: { Authorization: `Bearer ${admins.active.token}` } })).status, 200);
    const deactivated = await app.request('GET', '/api/v1/admin/posts', { token: admins.deactivated.token });
    assert.equal(deactivated.status, 401);
    const expired = await app.request('GET', '/api/v1/admin/posts', { token: tokenFor(admins.active.id, { expiresIn: -10 }) });
    assert.equal(expired.status, 401);
    assert.equal(expired.body.code, 'ADMIN_SESSION_EXPIRED');
    const none = await app.request('GET', '/api/v1/admin/posts');
    assert.equal(none.status, 401);
    assert.equal(none.body.code, 'ADMIN_SIGN_IN_REQUIRED');
});

test('signing out ends every session of that admin, on every device', async () => {
    const first = (await login(admins.sessions.email)).body.data.token;
    const second = (await login(admins.sessions.email)).body.data.token;
    const out = await app.request('POST', '/api/v1/admin/auth/logout', { token: first });
    assert.equal(out.status, 200);
    for (const token of [first, second]) {
        const res = await app.request('GET', '/api/v1/admin/list', { token });
        assert.equal(res.status, 401);
        assert.equal(res.body.code, 'ADMIN_SESSION_EXPIRED');
    }
    const again = (await login(admins.sessions.email)).body.data.token;
    assert.equal((await app.request('GET', '/api/v1/admin/list', { token: again })).status, 200);
});

test('a new password ends the sessions; the new one signs in', async () => {
    const token = (await login(admins.password.email)).body.data.token;
    const changed = await app.request('POST', '/api/v1/admin/auth/change-password', {
        token, body: { old_password: PASSWORD, new_password: 'NewAdminPass456', confirm_password: 'NewAdminPass456' },
    });
    assert.equal(changed.status, 200, changed.body.message);
    assert.equal((await app.request('GET', '/api/v1/admin/list', { token })).status, 401);
    assert.equal((await login(admins.password.email)).status, 401);
    assert.equal((await login(admins.password.email, 'NewAdminPass456')).status, 200);
});

test('a URL with a double slash reaches the route (the admin panel builds some)', async () => {
    const res = await app.request('GET', '/api/v1//admin/list', { token: admins.active.token });
    assert.equal(res.status, 200);
});

test('a new admin needs no department', async () => {
    const res = await app.request('POST', '/api/v1/admin/auth/register', {
        token: admins.active.token,
        body: { name: 'New Admin', email: `new-${stamp}@test.example`, password: 'NewAdminPass456', role_id: 2 },
    });
    assert.equal(res.status, 201, res.body.message);
    const [row] = await q('SELECT department_id FROM admins WHERE email = ?', [`new-${stamp}@test.example`]);
    assert.equal(row.department_id, process.env.ADM_DEPT_ID ? Number(process.env.ADM_DEPT_ID) : null);
});

test('the admin OTP request does not say whether an email belongs to an admin', async () => {
    const res = await app.request('POST', '/api/v1/admin/auth/otp', { body: { email: `nobody-${stamp}@test.example` } });
    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'If this email belongs to an admin, an OTP has been sent to it.');
});
