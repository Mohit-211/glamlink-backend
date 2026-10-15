// Errors reach clients in one shape, without database or library messages.
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
require('./env');
const ApiError = require('../src/core/http/ApiError');
const errorHandler = require('../src/core/http/errorHandler');
const { startApp } = require('./helpers');

// Calls the error handler with a stand-in response and returns what it sent.
const handle = (err) => {
    const sent = {};
    const res = {
        locals: {},
        status(code) { sent.status = code; return this; },
        json(body) { sent.body = body; return this; },
    };
    errorHandler(err, { method: 'GET', originalUrl: '/test' }, res, () => {});
    return sent;
};

describe('the error handler', () => {
    test('an expected error keeps its status, message and code', () => {
        const { status, body } = handle(ApiError.withCode(404, 'Address not found', 'ADDRESS_NOT_FOUND'));
        assert.equal(status, 404);
        assert.deepEqual(body, { success: false, status: 404, message: 'Address not found', code: 'ADDRESS_NOT_FOUND', data: '' });
    });

    test("a Stripe payment error keeps Stripe's status and message", () => {
        const err = Object.assign(new Error('Your card was declined.'), { type: 'StripeCardError', statusCode: 402, code: 'card_declined' });
        const { status, body } = handle(err);
        assert.equal(status, 402);
        assert.equal(body.message, 'Your card was declined.');
        assert.equal(body.code, 'PAYMENT_FAILED');
    });

    test('anything else is a generic 500 that does not reveal the message', () => {
        const { status, body } = handle(new Error("Unknown column 'secret_column' in 'field list'"));
        assert.equal(status, 500);
        assert.equal(body.message, 'An internal server error occurred.');
        assert.ok(!JSON.stringify(body).includes('secret_column'));
    });
});

describe('through the API', () => {
    let app;
    before(async () => { app = await startApp(); });
    after(() => app.close());

    test('a database error in a service answers a generic 500', async () => {
        // An invalid sort direction makes the database layer throw; its message used to reach the client.
        const res = await app.request('GET', '/api/v1/country?sortBy=SIDEWAYS');
        assert.equal(res.status, 500);
        assert.equal(res.body.message, 'An internal server error occurred.');
    });
});
