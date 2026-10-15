// Cross-origin access: only the origins in ACCESSDOMAINS, never a wildcard.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

let app;
let allowed;
before(async () => {
    app = await startApp();
    allowed = require('../src/core/http/cors').allowedOrigins[0];
});
after(() => app.close());

test('an allowed origin gets its own origin back, with credentials', async () => {
    const res = await app.request('GET', '/api/v1/country', { headers: { Origin: allowed } });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('access-control-allow-origin'), allowed);
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
});

test('a preflight from an allowed origin is answered', async () => {
    const res = await app.request('OPTIONS', '/api/v1/user/auth/login', {
        headers: { Origin: allowed, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-access-token' },
    });
    assert.ok(res.status === 200 || res.status === 204);
    assert.equal(res.headers.get('access-control-allow-origin'), allowed);
});

test('another origin is refused with 403 before the request runs', async () => {
    const res = await app.request('GET', '/api/v1/country', { headers: { Origin: 'https://evil.example' } });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'ORIGIN_NOT_ALLOWED');
    assert.notEqual(res.headers.get('access-control-allow-origin'), '*');
});

test('requests without an Origin (servers, the app) work and get no wildcard', async () => {
    const res = await app.request('GET', '/api/v1/country');
    assert.equal(res.status, 200);
    assert.notEqual(res.headers.get('access-control-allow-origin'), '*');
});
