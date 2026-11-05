// The webhook endpoint npm run stripe:webhook makes (website/access-card/webhookEndpoint.js): on the code's API
// version whatever the account's default (a new account's is newer, Nov 5), with every event, and its secret given
// back only when it is made. Stripe is faked (test/fakeStripe.js).
const { installFakeStripe } = require('./fakeStripe');
const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

let stripe, ensureWebhookEndpoint, API_VERSION, endpoints, calls;
const URL = 'https://api.glamlink.example/api/v1/payment/stripe/charge-intent/webhooks';
const EVENTS = ['invoice.paid', 'charge.succeeded', 'charge.refunded'];

before(() => {
    stripe = installFakeStripe();
    ({ ensureWebhookEndpoint } = require('../src/website/access-card/webhookEndpoint'));
    ({ API_VERSION } = require('../src/integrations/stripe'));
    const hooks = stripe.client.webhookEndpoints;
    hooks.list = async () => ({ data: endpoints });
    hooks.create = async (params) => {
        calls.push(['create', params]);
        return { id: 'we_new', secret: 'whsec_new', status: 'enabled', ...params };
    };
    hooks.update = async (id, params) => {
        calls.push(['update', id, params]);
        return { ...endpoints.find((e) => e.id === id), ...params };
    };
});

beforeEach(() => {
    endpoints = [];
    calls = [];
});

test('no endpoint on the URL: one is made on the code\'s API version with every event, and its secret comes back', async () => {
    endpoints = [{ id: 'we_other', url: 'https://elsewhere.example/hook', api_version: '2022-11-15', enabled_events: ['*'], status: 'enabled' }];
    const result = await ensureWebhookEndpoint({ url: URL, events: EVENTS });
    assert.equal(result.secret, 'whsec_new');
    assert.deepEqual(calls, [['create', { url: URL, enabled_events: EVENTS, api_version: API_VERSION, description: 'Glamlink API: Access payments' }]]);
});

test('an endpoint already on the URL gets only the events it misses, and is turned back on; no secret', async () => {
    endpoints = [{ id: 'we_1', url: URL, api_version: API_VERSION, enabled_events: ['invoice.paid'], status: 'disabled' }];
    const result = await ensureWebhookEndpoint({ url: URL, events: EVENTS });
    assert.deepEqual(result.added, ['charge.succeeded', 'charge.refunded']);
    assert.equal(result.secret, undefined);
    assert.deepEqual(calls, [['update', 'we_1', { enabled_events: ['invoice.paid', 'charge.succeeded', 'charge.refunded'], disabled: false }]]);
});

test('an endpoint with every event and enabled is left alone', async () => {
    endpoints = [{ id: 'we_1', url: URL, api_version: API_VERSION, enabled_events: EVENTS, status: 'enabled' }];
    const result = await ensureWebhookEndpoint({ url: URL, events: EVENTS });
    assert.deepEqual(result.added, []);
    assert.deepEqual(calls, []);
});

test('an endpoint on another API version is reported, not changed', async () => {
    endpoints = [{ id: 'we_1', url: URL, api_version: '2026-10-28.newer', enabled_events: EVENTS, status: 'enabled' }];
    const result = await ensureWebhookEndpoint({ url: URL, events: EVENTS });
    assert.equal(result.wrongVersion, true);
    assert.deepEqual(calls, []);
});
