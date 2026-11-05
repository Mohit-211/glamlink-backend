#!/usr/bin/env node
/**
 * Makes the Stripe webhook endpoint the API listens on, with the keys in .env: API_BASE_URL's webhook URL, the API
 * version the code is written for, and every event the Access handlers take. Its signing secret goes into .env
 * (STRIPE_WEBHOOK_SECRET_INTENT_CHARGE) without being printed. An endpoint already on that URL gets the events it
 * misses (docs/deploy.md section 5). Then reload the API.
 *
 *   node scripts/stripe-webhook.js
 */
process.loadEnvFile(require('path').join(__dirname, '..', '.env'));
const fs = require('fs');
const path = require('path');
const config = require('../src/core/config/config');
const { API_VERSION, accountName } = require('../src/integrations/stripe');
const { ensureWebhookEndpoint } = require('../src/website/access-card/webhookEndpoint');
const sequelize = require('../src/core/db/central.db');

const ENV_FILE = path.join(__dirname, '..', '.env');
const SECRET_KEY = 'STRIPE_WEBHOOK_SECRET_INTENT_CHARGE';
const EVENTS = Object.keys(require('../src/website/access-card').stripeHandlers());

// The secret's line in .env replaced (or added at the end); every other line, comments included, kept.
const saveSecret = (secret) => {
    const lines = fs.readFileSync(ENV_FILE, 'utf8').replace(/\n+$/, '').split('\n').filter((line) => !line.startsWith(`${SECRET_KEY}=`));
    fs.writeFileSync(ENV_FILE, `${[...lines, `${SECRET_KEY}=${secret}`].join('\n')}\n`);
};

(async () => {
    const mode = String(config.STRIPE_SECRET_KEY || '').startsWith('sk_live') ? 'LIVE' : 'test';
    const url = `${String(config.API_BASE_URL || '').replace(/\/+$/, '')}/api/v1/payment/stripe/charge-intent/webhooks`;
    console.log(`Stripe (${mode} keys, account ${await accountName()})\n`);
    const { endpoint, secret, added, wrongVersion } = await ensureWebhookEndpoint({ url, events: EVENTS });
    if (wrongVersion) {
        console.log(`${endpoint.id} on ${url} is on API version ${endpoint.api_version}, not ${API_VERSION}, and Stripe can't change that.`);
        console.log('Delete it in the dashboard (Developers > Webhooks), then run this again.');
        process.exitCode = 1;
    } else if (secret) {
        saveSecret(secret);
        console.log(`Made ${endpoint.id}: ${url}, API version ${API_VERSION}, ${EVENTS.length} events.`);
        console.log(`Its signing secret is in .env (${SECRET_KEY}). Now: pm2 reload glamlink-api --update-env`);
    } else {
        console.log(`${endpoint.id} on ${url} was already there${added.length ? `; it now also sends ${added.join(', ')}` : ', sending every event'}.`);
        console.log(`.env keeps its signing secret. If ${SECRET_KEY} is not that one, copy it from the dashboard (the endpoint > Signing secret).`);
    }
    await sequelize.close();
})().catch(async (err) => {
    console.error(err.message);
    await sequelize.close();
    process.exit(1);
});
