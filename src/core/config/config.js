const fs = require('fs')

// Node loads .env natively. Variables already set in the environment take precedence.
// Quote any value that contains #, or everything from the # onwards is dropped.
const { ENV_FILE } = require('./paths');
if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const fail = (message) => {
    throw new Error(`Config validation error: ${message}`);
};

// Empty values (`KEY=`) count as unset.
const envVars = Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ''));

const REQUIRED = ['APP_NAME', 'NODE_ENV', 'CENTRAL_MYSQL_HOST', 'CENTRAL_MYSQL_USER', 'CENTRAL_MYSQL_DB', 'CENTRAL_MYSQL_PORT', 'JWT_SECRET'];
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
envVars.JWT_ACCESS_EXPIRATION_DAYS = number('JWT_ACCESS_EXPIRATION_DAYS', 7);
envVars.DEFAULT_TIMEZONE ??= 'UTC';

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
        accessExpirationDays: envVars.JWT_ACCESS_EXPIRATION_DAYS,
    },
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
    },
    accessDomains: envVars.ACCESSDOMAINS,
    defaultLimit: envVars.DEFAULT_API_DATA_LIMIT,
    API_BASE_URL: envVars.API_BASE_URL,
    DEFAULT_TIMEZONE: envVars.DEFAULT_TIMEZONE,
    STORY_VALIDATION_TIME_SPAN_HOURS: envVars.STORY_VALIDATION_TIME_SPAN_HOURS,
    
    STRIPE_PUBLISHABLE_KEY: envVars.STRIPE_PUBLISHABLE_KEY,
    STRIPE_SECRET_KEY: envVars.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET_INTENT_CHARGE: envVars.STRIPE_WEBHOOK_SECRET_INTENT_CHARGE,
    STRIPE_WEBHOOK_SECRET_CUSTOMER_INVOICE_PRICE: envVars.STRIPE_WEBHOOK_SECRET_CUSTOMER_INVOICE_PRICE,

    NUMERAL_API_KEY: envVars.NUMERAL_API_KEY,
    NUMERAL_BASE_URL: envVars.NUMERAL_BASE_URL,
    SHIPPO_API_KEY:envVars.SHIPPO_API_KEY,

    SUP_ADM_ROLE_ID: envVars.SUP_ADM_ROLE_ID,
    USR_ROLE_ID: envVars.USR_ROLE_ID,
    CLLR_ROLE_ID: envVars.CLLR_ROLE_ID,
    BRND_ROLE_ID: envVars.BRND_ROLE_ID,
    ADM_DEPT_ID: envVars.ADM_DEPT_ID,
    SUPER_ADMIN_NAME: envVars.SUPER_ADMIN_NAME,
    SUPER_ADMIN_PASSWORD: envVars.SUPER_ADMIN_PASSWORD,
    SUPER_ADMIN_EMAIL: envVars.SUPER_ADMIN_EMAIL,

    GOOGLE_PLACE_API_KEY: envVars.GOOGLE_PLACE_API_KEY,
    GOOGLE_PLACE_API_URL: envVars.GOOGLE_PLACE_API_URL,

    GOOGLE_API_KEY: envVars.GOOGLE_API_KEY,
    
    DELETED_EMAIL: envVars.DELETED_EMAIL,
    DELETED_NAME: envVars.DELETED_NAME,

    // GOOGLE_APPLICATION_CREDENTIALS: envVars.GOOGLE_APPLICATION_CREDENTIALS,
};
