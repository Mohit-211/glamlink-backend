// Node loads .env natively (paths.js loads it, first thing). Variables already set in the environment take
// precedence. Quote any value that contains #, or everything from the # onwards is dropped.
require('./paths');

const fail = (message) => {
    throw new Error(`Config validation error: ${message}`);
};

// Empty values (`KEY=`) count as unset.
const envVars = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ''));

const REQUIRED = ['APP_NAME', 'NODE_ENV', 'CENTRAL_MYSQL_HOST', 'CENTRAL_MYSQL_USER', 'CENTRAL_MYSQL_DB', 'CENTRAL_MYSQL_PORT', 'JWT_SECRET', 'PROFESSIONAL_ROLE_ID'];
const missing = REQUIRED.filter((key) => envVars[key] === undefined);
if (missing.length) fail(`missing ${missing.join(', ')}`);
if (!['production', 'development', 'test'].includes(envVars.NODE_ENV)) fail('NODE_ENV must be one of production, development, test');

const number = (key, fallback) => {
    if (envVars[key] === undefined) return fallback;
    const value = Number(envVars[key]);
    if (Number.isNaN(value)) fail(`${key} must be a number`);
    return value;
};

envVars.PORT = number('PORT', 5000);
envVars.SMTP_PORT = number('SMTP_PORT');
envVars.DEFAULT_API_DATA_LIMIT = number('DEFAULT_API_DATA_LIMIT', 15);
envVars.ACCESS_TOKEN_MINUTES = number('ACCESS_TOKEN_MINUTES', 15);
envVars.REFRESH_TOKEN_DAYS = number('REFRESH_TOKEN_DAYS', 30);
envVars.ADMIN_TOKEN_HOURS = number('ADMIN_TOKEN_HOURS', 12);
// Scheduled jobs run unless JOBS_ENABLED=false (testing mode on a copy of live data: nothing runs on its own clock).
envVars.JOBS_ENABLED = envVars.JOBS_ENABLED !== 'false';

// Production refuses settings that would quietly weaken it.
if (envVars.NODE_ENV === 'production') {
    // Admin tokens are signed with the hex-decoded secret: anything that is not hex decodes to a short or empty key.
    if (!/^[0-9a-f]{64,}$/i.test(envVars.JWT_SECRET) || envVars.JWT_SECRET.length % 2) {
        fail('JWT_SECRET must be at least 64 hex characters in production (openssl rand -hex 32)');
    }
    for (const key of ['API_BASE_URL', 'ACCESSDOMAINS']) if (envVars[key] === undefined) fail(`${key} is required in production`);
}
envVars.WEBSITE_URL = (envVars.WEBSITE_URL || 'https://glamlink.net').replace(/\/+$/, '');
envVars.ADMIN_URL = (envVars.ADMIN_URL || 'https://admin.glamlink.net').replace(/\/+$/, '');
envVars.SHIPPO_ADDRESS_VALIDATION ??= 'legacy';
if (!['legacy', 'v2'].includes(envVars.SHIPPO_ADDRESS_VALIDATION)) fail('SHIPPO_ADDRESS_VALIDATION must be legacy or v2');
envVars.DEFAULT_TIMEZONE ??= 'UTC';
envVars.MAIL_TRANSPORT ??= 'smtp';
if (!['smtp', 'log'].includes(envVars.MAIL_TRANSPORT)) fail('MAIL_TRANSPORT must be smtp or log');

// Firebase is optional: all three set, or none (push notifications and chat are then off).
const FIREBASE = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];
const firebaseSet = FIREBASE.filter((key) => envVars[key] !== undefined);
if (firebaseSet.length && firebaseSet.length < FIREBASE.length) {
    fail(`set all of ${FIREBASE.join(', ')} or none (missing ${FIREBASE.filter((key) => !firebaseSet.includes(key)).join(', ')})`);
}

module.exports = {
    app_name: envVars.APP_NAME,
    env: envVars.NODE_ENV,
    port: envVars.PORT,
    databases: {
        central: {
            db: envVars.CENTRAL_MYSQL_DB,
            port: envVars.CENTRAL_MYSQL_PORT,
            host: envVars.CENTRAL_MYSQL_HOST,
            user: envVars.CENTRAL_MYSQL_USER,
            passwd: envVars.CENTRAL_MYSQL_PASSWORD
        },
    },
    jwt: {
        secret: envVars.JWT_SECRET,
        accessTokenMinutes: envVars.ACCESS_TOKEN_MINUTES,
        refreshTokenDays: envVars.REFRESH_TOKEN_DAYS,
        adminTokenHours: envVars.ADMIN_TOKEN_HOURS,
    },
    jobsEnabled: envVars.JOBS_ENABLED,
    email: {
        smtp: {
            host: envVars.SMTP_HOST,
            port: envVars.SMTP_PORT,
            secure: true,
            requireTLS: false,
            auth: {
                user: envVars.SMTP_USERNAME,
                pass: envVars.SMTP_PASSWORD,
            },
        },
        from: envVars.EMAIL_FROM,
        transport: envVars.MAIL_TRANSPORT,
    },
    accessDomains: envVars.ACCESSDOMAINS,
    defaultLimit: envVars.DEFAULT_API_DATA_LIMIT,
    API_BASE_URL: envVars.API_BASE_URL,
    // The website, for links in emails (verify email, reset password)
    WEBSITE_URL: envVars.WEBSITE_URL,
    // The admin panel, for links in admin emails (an Access order)
    ADMIN_URL: envVars.ADMIN_URL,
    DEFAULT_TIMEZONE: envVars.DEFAULT_TIMEZONE,
    STORY_VALIDATION_TIME_SPAN_HOURS: envVars.STORY_VALIDATION_TIME_SPAN_HOURS,
    
    STRIPE_PUBLISHABLE_KEY: envVars.STRIPE_PUBLISHABLE_KEY,
    STRIPE_SECRET_KEY: envVars.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET_INTENT_CHARGE: envVars.STRIPE_WEBHOOK_SECRET_INTENT_CHARGE,
    STRIPE_WEBHOOK_SECRET_CUSTOMER_INVOICE_PRICE: envVars.STRIPE_WEBHOOK_SECRET_CUSTOMER_INVOICE_PRICE,
    // The old purchase flow's Stripe prices: the Access products adopt them when set (scripts/stripe-setup.js).
    STRIPE_LEGACY_PRICES: {
        pro: envVars.STRIPE_GLAMLINK_MONTHLY_PRICE_ID,
        keychain: envVars.STRIPE_GLAMLINK_SETUP_PRICE_ID,
        shipping: envVars.STRIPE_SHIPPING_PRICE_ID,
    },

    NUMERAL_API_KEY: envVars.NUMERAL_API_KEY,
    NUMERAL_BASE_URL: envVars.NUMERAL_BASE_URL,
    SHIPPO_API_KEY:envVars.SHIPPO_API_KEY,
    // Shippo's address check: legacy (POST /addresses, every account) or v2 (/v2/addresses/validate, enabled by Shippo).
    SHIPPO_ADDRESS_VALIDATION: envVars.SHIPPO_ADDRESS_VALIDATION,
    // The secret token at the end of the Shippo webhook URL, and Shippo's HMAC secret once they set one up.
    SHIPPO_WEBHOOK_TOKEN: envVars.SHIPPO_WEBHOOK_TOKEN,
    SHIPPO_WEBHOOK_HMAC_SECRET: envVars.SHIPPO_WEBHOOK_HMAC_SECRET,
    // Where keychains ship from (the warehouse).
    SHIP_FROM: {
        name: envVars.SHIP_FROM_NAME,
        company: envVars.SHIP_FROM_COMPANY,
        street1: envVars.SHIP_FROM_STREET1,
        street2: envVars.SHIP_FROM_STREET2,
        city: envVars.SHIP_FROM_CITY,
        state: envVars.SHIP_FROM_STATE,
        zip: envVars.SHIP_FROM_ZIP,
        country: envVars.SHIP_FROM_COUNTRY || 'US',
        phone: envVars.SHIP_FROM_PHONE,
        email: envVars.SHIP_FROM_EMAIL,
    },

    SUP_ADM_ROLE_ID: envVars.SUP_ADM_ROLE_ID,
    USR_ROLE_ID: envVars.USR_ROLE_ID,
    PROFESSIONAL_ROLE_ID: envVars.PROFESSIONAL_ROLE_ID,
    BRND_ROLE_ID: envVars.BRND_ROLE_ID,
    ADM_DEPT_ID: envVars.ADM_DEPT_ID,
    SUPER_ADMIN_NAME: envVars.SUPER_ADMIN_NAME,
    SUPER_ADMIN_PASSWORD: envVars.SUPER_ADMIN_PASSWORD,
    SUPER_ADMIN_EMAIL: envVars.SUPER_ADMIN_EMAIL,

    GOOGLE_PLACE_API_KEY: envVars.GOOGLE_PLACE_API_KEY,
    GOOGLE_PLACE_API_URL: envVars.GOOGLE_PLACE_API_URL,

    GOOGLE_API_KEY: envVars.GOOGLE_API_KEY,
    // YouTube Data API v3, for the Watch videos (website/watch): the playlists' new uploads and pasted links.
    YOUTUBE_API_KEY: envVars.YOUTUBE_API_KEY,
    
    DELETED_EMAIL: envVars.DELETED_EMAIL,
    DELETED_NAME: envVars.DELETED_NAME,

    // The service account's fields from its Google key file; null when Firebase is not configured.
    firebase: firebaseSet.length ? {
        projectId: envVars.FIREBASE_PROJECT_ID,
        clientEmail: envVars.FIREBASE_CLIENT_EMAIL,
        // Kept on one line in .env with \n for the line breaks
        privateKey: envVars.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        databaseURL: envVars.FIREBASE_DATABASE_URL || `https://${envVars.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`,
    } : null,
};
