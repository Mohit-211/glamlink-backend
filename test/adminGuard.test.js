// One admin guard on the website and shared routes (requireAdmin), and no sign-in for deactivated admins.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { startApp } = require('./helpers');

let app;
const admins = {};
const PASSWORD = 'AdminPass123';
const tokenFor = (id) => jwt.sign({ id, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' });

before(async () => {
    app = await startApp();
    const q = async (sql, replacements = []) => (await app.sequelize.query(sql, { replacements }))[0];
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM')");
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const hash = await bcrypt.hash(PASSWORD, 8);
    for (const [key, active] of [['active', 1], ['deactivated', 0]]) {
        const email = `${key}-${stamp}@test.example`;
        const res = await q('INSERT INTO admins (name, email, password, role_id, is_active) VALUES (?, ?, ?, 1, ?)', [key, email, hash, active]);
        admins[key] = { id: res.insertId ?? res, email, token: tokenFor(res.insertId ?? res) };
    }
});
after(() => app.close());

test('a deactivated admin cannot sign in', async () => {
    const ok = await app.request('POST', '/api/v1/admin/auth/login', { body: { email: admins.active.email, password: PASSWORD } });
    assert.equal(ok.status, 200);
    const refused = await app.request('POST', '/api/v1/admin/auth/login', { body: { email: admins.deactivated.email, password: PASSWORD } });
    assert.equal(refused.status, 400);
    assert.equal(refused.body.message, 'User not found.');
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
