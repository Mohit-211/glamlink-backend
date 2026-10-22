// Run on the server after pulling and filling in .env (docs/deploy.md): checks the settings, the storage folders,
// the database and its migrations, and shows which mode the API is in (testing or live). Exits with 1 when
// something must be fixed first.
//
//   npm run check:server               settings, storage, database
//   npm run check:server -- --online   also asks Stripe and Shippo whether the keys work, and looks for the webhook
const fs = require('fs');
const path = require('path');

const online = process.argv.includes('--online');
let errors = 0;
let warnings = 0;
const ok = (text) => console.log(`  ok    ${text}`);
const warn = (text) => { warnings += 1; console.log(`  warn  ${text}`); };
const fail = (text) => { errors += 1; console.log(`  FAIL  ${text}`); };
const section = (title) => console.log(`\n${title}`);

let config;
try {
    config = require('../src/core/config/config');
} catch (error) {
    console.log(`  FAIL  ${error.message}`);
    process.exit(1);
}
const paths = require('../src/core/config/paths');
const value = (key) => (process.env[key] === undefined || process.env[key] === '' ? undefined : process.env[key]);
const production = config.env === 'production';
const PLACEHOLDER = /^(sk_test_xxx|pk_test_xxx|whsec_xxx|price_xxx|change-me|replace-with.*|.*example\.com)$/i;
const keyMode = (key) => (/^(sk|pk|rk)_live_/.test(key || '') ? 'live' : /^(sk|pk|rk)_test_/.test(key || '') ? 'test' : 'unknown');

const settings = () => {
    section('Mode');
    ok(`NODE_ENV=${config.env}, port ${config.port}, ${config.API_BASE_URL || '(no API_BASE_URL)'}`);
    ok(`website ${config.WEBSITE_URL}, admin panel ${config.ADMIN_URL}`);
    ok(`CORS origins: ${require('../src/core/http/cors').allowedOrigins.join(', ') || '(none)'}`);
    const stripeMode = keyMode(value('STRIPE_SECRET_KEY'));
    const shippoKey = value('SHIPPO_API_KEY') || '';
    const shippoMode = shippoKey.startsWith('shippo_live_') ? 'live' : shippoKey.startsWith('shippo_test_') ? 'test' : 'unknown';
    ok(`jobs ${config.jobsEnabled ? 'on' : 'off'}, email ${config.email.transport === 'log' ? 'to the log only' : 'sent (SMTP)'}, push ${config.firebase ? 'on' : 'off'}, Stripe ${stripeMode}, Shippo ${shippoMode}`);
    const testing = !config.jobsEnabled && config.email.transport === 'log' && stripeMode !== 'live';
    const live = config.jobsEnabled && config.email.transport === 'smtp' && stripeMode === 'live';
    if (testing) ok('testing mode: no jobs, no email, no real charges');
    else if (live) ok('live mode');
    else warn('neither testing nor live mode: check JOBS_ENABLED, MAIL_TRANSPORT and the Stripe keys (docs/deploy.md, ".env")');

    section('Settings');
    const need = (label, keys, { required = production } = {}) => {
        const missing = keys.filter((k) => !value(k));
        const placeholders = keys.filter((k) => value(k) && PLACEHOLDER.test(value(k)));
        if (placeholders.length) fail(`${label}: placeholder value in ${placeholders.join(', ')}`);
        else if (missing.length) (required ? fail : warn)(`${label}: missing ${missing.join(', ')}`);
        else ok(label);
    };
    need('Stripe', ['STRIPE_SECRET_KEY', 'STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET_INTENT_CHARGE']);
    if (value('STRIPE_SECRET_KEY') && value('STRIPE_PUBLISHABLE_KEY') && keyMode(value('STRIPE_SECRET_KEY')) !== keyMode(value('STRIPE_PUBLISHABLE_KEY'))) {
        fail('Stripe: the secret and publishable keys are from different modes (test and live)');
    }
    need('Sign-up captcha (Turnstile)', ['TURNSTILE_SECRET_KEY']);
    if (config.email.transport === 'smtp') need('Email (SMTP)', ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USERNAME', 'SMTP_PASSWORD', 'EMAIL_FROM']);
    need('Keychain shipping (Shippo)', ['SHIPPO_API_KEY', 'SHIPPO_WEBHOOK_TOKEN'], { required: false });
    need('Keychain ship-from address', ['SHIP_FROM_NAME', 'SHIP_FROM_STREET1', 'SHIP_FROM_CITY', 'SHIP_FROM_STATE', 'SHIP_FROM_ZIP', 'SHIP_FROM_PHONE', 'SHIP_FROM_EMAIL'], { required: false });
    need('Google (address coordinates, place details)', ['GOOGLE_API_KEY'], { required: false });
    need('YouTube (the Watch videos)', ['YOUTUBE_API_KEY'], { required: false });
    need('Super Admin for `npm run auth`', ['SUPER_ADMIN_EMAIL', 'SUPER_ADMIN_PASSWORD'], { required: false });
};

const UPLOAD_FOLDERS = ['images', 'videos', 'gifs', 'docs', 'audios', 'csv'];

const storage = () => {
    section('Storage');
    ok(`STORAGE_DIR ${paths.STORAGE_DIR}`);
    for (const dir of [paths.UPLOADS_DIR, paths.LOGS_DIR]) {
        try {
            fs.mkdirSync(dir, { recursive: true });
            const probe = path.join(dir, `.write-check-${process.pid}`);
            fs.writeFileSync(probe, 'ok');
            fs.unlinkSync(probe);
            ok(`${dir} is writable`);
        } catch (error) {
            fail(`${dir}: ${error.message}`);
        }
    }
    const counts = UPLOAD_FOLDERS.map((folder) => {
        const dir = path.join(paths.UPLOADS_DIR, folder);
        return [folder, fs.existsSync(dir) ? fs.readdirSync(dir).length : 0];
    });
    const files = counts.reduce((sum, [, n]) => sum + n, 0);
    (files ? ok : warn)(`uploads: ${counts.map(([folder, n]) => `${folder} ${n}`).join(', ')}${files ? '' : ' (copy the old uploads: docs/deploy.md)'}`);
};

const database = async () => {
    section('Database');
    const { connect } = require('../src/core/db/migrate');
    const sequelize = connect();
    try {
        const [[{ version }]] = await sequelize.query('SELECT VERSION() AS version');
        ok(`connected to ${config.databases.central.db} on ${config.databases.central.host} (${version})`);
        const [tables] = await sequelize.query("SHOW TABLES LIKE 'schema_migrations'");
        const applied = new Set(tables.length ? (await sequelize.query('SELECT name FROM schema_migrations'))[0].map((r) => r.name) : []);
        const files = fs.readdirSync(path.join(__dirname, '../src/core/db/migrations')).filter((f) => f.endsWith('.js'));
        const pending = files.filter((f) => !applied.has(f));
        if (pending.length) fail(`${pending.length} migrations pending: run npm run migrate (first: ${pending[0]})`);
        else ok(`all ${files.length} migrations applied`);
        if (!pending.length) {
            const [[counts]] = await sequelize.query(`SELECT
                (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS users,
                (SELECT COUNT(*) FROM business_cards WHERE deleted_at IS NULL) AS cards,
                (SELECT COUNT(*) FROM admins WHERE is_active = 1 AND deleted_at IS NULL) AS admins`);
            ok(`${counts.users} accounts, ${counts.cards} cards, ${counts.admins} active admins`);
            if (!Number(counts.admins)) warn('no active admin: create one with npm run auth');
            const [[old]] = await sequelize.query("SELECT COUNT(*) AS n FROM business_cards WHERE profile_image LIKE '%node.glamlink.net%'");
            if (Number(old.n)) warn(`${old.n} card photos still link to node.glamlink.net (is API_BASE_URL right? see the file links migration)`);
            const base = String(config.API_BASE_URL || '').replace(/\/+$/, '');
            const [[sample]] = await sequelize.query(
                "SELECT profile_image AS url FROM business_cards WHERE deleted_at IS NULL AND profile_image LIKE CONCAT(?, '/images/%') ORDER BY id DESC LIMIT 1",
                { replacements: [base] },
            );
            if (sample) {
                const file = path.join(paths.UPLOADS_DIR, decodeURIComponent(sample.url.slice(base.length + 1)));
                (fs.existsSync(file) ? ok : warn)(`a card photo's file ${fs.existsSync(file) ? 'is in' : 'is missing from'} the uploads folder (${path.basename(file)})`);
            }
        }
    } catch (error) {
        fail(`database: ${error.message}`);
    } finally {
        await sequelize.close();
    }
};

const services = async () => {
    section('Stripe and Shippo (online)');
    if (value('STRIPE_SECRET_KEY')) {
        try {
            const { stripe } = require('../src/integrations/stripe');
            await stripe().balance.retrieve();
            ok('Stripe accepts the secret key');
            const url = `${String(config.API_BASE_URL || '').replace(/\/+$/, '')}/api/v1/payment/stripe/charge-intent/webhooks`;
            const endpoints = (await stripe().webhookEndpoints.list({ limit: 100 })).data;
            const hook = endpoints.find((e) => e.url === url);
            if (!hook) fail(`no Stripe webhook endpoint for ${url} (npm run stripe:setup prints the events to add)`);
            else if (hook.status !== 'enabled') fail(`the Stripe webhook for ${url} is ${hook.status}`);
            else ok(`Stripe webhook ${url} (API version ${hook.api_version || 'account default'})`);
        } catch (error) {
            fail(`Stripe: ${error.message}`);
        }
    }
    if (value('SHIPPO_API_KEY')) {
        try {
            const httpClient = require('../src/core/http/httpClient');
            await httpClient.request({
                method: 'get',
                url: 'https://api.goshippo.com/addresses?results=1',
                headers: { Authorization: `ShippoToken ${value('SHIPPO_API_KEY')}` },
                timeout: 15000,
            });
            ok('Shippo accepts the API key');
        } catch (error) {
            fail(`Shippo: ${error.response?.status || ''} ${error.message}`);
        }
    }
};

(async () => {
    settings();
    storage();
    await database();
    if (online) await services();
    console.log(`\n${errors ? `${errors} to fix` : 'Ready'}${warnings ? `, ${warnings} warnings` : ''}.`);
    process.exit(errors ? 1 : 0);
})();
