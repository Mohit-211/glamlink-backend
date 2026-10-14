const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

let app;
before(async () => {
    app = await startApp();
});
after(() => app.close());

test('runs against the test database', async () => {
    const [[{ db }]] = await app.sequelize.query('SELECT DATABASE() AS db');
    assert.equal(db, 'glamlink_test');
});

test('the schema comes from the migrations', async () => {
    const [rows] = await app.sequelize.query('SELECT name FROM schema_migrations');
    assert.ok(rows.some((r) => r.name === '20261014-0000-baseline.js'));
});

test('health check answers', async () => {
    const res = await app.request('GET', '/api/healthcheck');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { response: 'ok' });
});

test('unknown routes return the JSON 404', async () => {
    const res = await app.request('GET', '/api/v1/no-such-route');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
});
