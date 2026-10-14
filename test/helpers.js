// Test helpers: start the app on a free port and call it like a client would.
require('./env');
const { once } = require('events');

const startApp = async () => {
    const app = require('../app');
    const sequelize = require('../src/core/db/central.db');
    const { outbox } = require('../src/integrations/mailer/transport');
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;

    // { status, body } for a JSON request; `token` goes in x-access-token like the website sends it.
    const request = async (method, path, { body, token, headers = {} } = {}) => {
        const init = { method, headers: { ...(token && { 'x-access-token': token }), ...headers } };
        if (body !== undefined) {
            init.headers['Content-Type'] = 'application/json';
            init.body = JSON.stringify(body);
        }
        const res = await fetch(base + path, init);
        const text = await res.text();
        let json;
        try {
            json = JSON.parse(text);
        } catch {
            json = text;
        }
        return { status: res.status, body: json, headers: res.headers };
    };

    const close = async () => {
        server.close();
        await sequelize.close();
    };

    return { base, request, outbox, sequelize, close };
};

module.exports = { startApp };
