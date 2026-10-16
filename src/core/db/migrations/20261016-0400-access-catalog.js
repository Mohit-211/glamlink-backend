// What the Access card sells and for how much (docs/access.md sections 2 and 3): the products and their list
// prices, the plans the website shows, price-change history, site-wide discounts, personal prices and the
// settings (what Free and Pro may do, shipping). Seeded with the website's plans and today's prices.
const TABLE_OPTIONS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

const FREE_FEATURES = [
    'Directory listing', 'Digital card & QR code', '1 featured video', 'Up to 4 photos', 'Contact info & bio',
    'Specialties & booking link', 'Social links, hours & location',
].map((text) => ({ text }));
const PRO_FEATURES = [
    { text: 'Directory listing & digital card' }, { text: 'Swap your featured video anytime' },
    { text: 'Refresh your photos anytime' }, { text: 'Run special offers' },
    { text: 'Performance analytics', soon: true }, { text: 'Priority placement in search', soon: true },
];
const KEYCHAIN = { text: 'NFC keychain — tap to share your profile', highlight: 'keychain' };

const PLANS = [
    ['free', 'Free access', 'Free', null, 'Get listed, no cost.', [], FREE_FEATURES, 1],
    ['nfc_only', 'Keychain', 'With keychain', null, 'Free listing, plus a tap-to-share NFC keychain.', ['keychain'], [...FREE_FEATURES, KEYCHAIN], 2],
    ['subscription_only', 'Access Pro', 'Pro', null, 'Everything in Free, plus ongoing control.', ['pro'], PRO_FEATURES, 3],
    ['nfc_with_subscription', 'Pro + keychain', 'Pro', 'Most popular', 'Full Pro plan with the NFC keychain included.', ['pro', 'keychain'], [...PRO_FEATURES, KEYCHAIN], 4],
];

const SETTINGS = {
    // What each tier may do (enforced on card edits and the public card).
    entitlements: {
        free: { photos: 4, videos: 1, edit_details: true, edit_media: false, special_offers: false, analytics: false, priority_search: false },
        pro: { photos: 4, videos: 1, edit_details: true, edit_media: true, special_offers: true, analytics: true, priority_search: true },
    },
    keychains_per_person: 1,
    // Shipping the keychain: live Shippo rates, or a flat amount, or free; where it ships; the parcel.
    shipping: {
        mode: 'live',
        flat_amount_cents: 0,
        countries: ['US'],
        parcel: { length: 4, width: 4, height: 1, distance_unit: 'in', weight: 0.2, mass_unit: 'lb' },
    },
};

module.exports = {
    up: async ({ sequelize }) => {
        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS access_products (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(30) NOT NULL UNIQUE,
                name VARCHAR(100) NOT NULL,
                kind ENUM('subscription','one_time') NOT NULL,
                amount_cents INT UNSIGNED NOT NULL,
                currency CHAR(3) NOT NULL DEFAULT 'usd',
                billing_interval ENUM('month','year') NULL,
                stripe_product_id VARCHAR(255) NULL,
                stripe_price_id VARCHAR(255) NULL,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ${TABLE_OPTIONS}
        `);
        await sequelize.query(`
            INSERT IGNORE INTO access_products (code, name, kind, amount_cents, currency, billing_interval) VALUES
            ('pro', 'Access Pro', 'subscription', 499, 'usd', 'month'),
            ('keychain', 'NFC keychain', 'one_time', 3999, 'usd', NULL)
        `);

        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS access_price_changes (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                product_code VARCHAR(30) NOT NULL,
                amount_before INT UNSIGNED NOT NULL,
                amount_after INT UNSIGNED NOT NULL,
                subscribers_moved TINYINT(1) NOT NULL DEFAULT 0,
                admin_id INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                KEY product_code (product_code)
            ) ${TABLE_OPTIONS}
        `);

        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS access_plans (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                code VARCHAR(40) NOT NULL UNIQUE,
                name VARCHAR(100) NOT NULL,
                label VARCHAR(40) NULL,
                badge VARCHAR(40) NULL,
                tagline VARCHAR(255) NULL,
                products LONGTEXT NOT NULL,
                features LONGTEXT NOT NULL,
                sort_order INT NOT NULL DEFAULT 0,
                is_active TINYINT(1) NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ${TABLE_OPTIONS}
        `);
        for (const [code, name, label, badge, tagline, products, features, sort] of PLANS) {
            await sequelize.query(
                'INSERT IGNORE INTO access_plans (code, name, label, badge, tagline, products, features, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                { replacements: [code, name, label, badge, tagline, JSON.stringify(products), JSON.stringify(features), sort] },
            );
        }

        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS access_discounts (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                percent_off DECIMAL(5,2) NULL,
                amount_off_cents INT UNSIGNED NULL,
                applies_to LONGTEXT NOT NULL,
                duration ENUM('once','repeating','forever') NOT NULL DEFAULT 'once',
                duration_in_months INT UNSIGNED NULL,
                starts_at DATETIME NOT NULL,
                ends_at DATETIME NULL,
                stripe_coupon_id VARCHAR(255) NULL,
                admin_id INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                KEY window_dates (starts_at, ends_at)
            ) ${TABLE_OPTIONS}
        `);

        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS access_price_overrides (
                id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NULL,
                email VARCHAR(255) NULL,
                product_code VARCHAR(30) NOT NULL,
                amount_cents INT UNSIGNED NOT NULL,
                note VARCHAR(255) NULL,
                ends_at DATETIME NULL,
                ended_at DATETIME NULL,
                admin_id INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                KEY user_product (user_id, product_code),
                KEY email_product (email, product_code)
            ) ${TABLE_OPTIONS}
        `);

        await sequelize.query(`
            CREATE TABLE IF NOT EXISTS access_settings (
                setting VARCHAR(50) NOT NULL PRIMARY KEY,
                value LONGTEXT NOT NULL,
                admin_id INT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ${TABLE_OPTIONS}
        `);
        for (const [setting, value] of Object.entries(SETTINGS)) {
            await sequelize.query('INSERT IGNORE INTO access_settings (setting, value) VALUES (?, ?)', { replacements: [setting, JSON.stringify(value)] });
        }
    },
    down: async ({ sequelize }) => {
        for (const table of ['access_settings', 'access_price_overrides', 'access_discounts', 'access_plans', 'access_price_changes', 'access_products']) {
            await sequelize.query(`DROP TABLE IF EXISTS ${table}`);
        }
    },
};
