// Shipping the keychain with Shippo (docs/access.md section 7). Addresses gain a second street line, the recipient,
// a phone, the city as checked, and the result of Shippo's check; a shipping address is marked as such (purpose)
// so it is never served as a business address (the existing Access card addresses too). Orders gain the chosen
// rate, the label, and tracking.
const columnsOf = async (sequelize, table) =>
    new Set((await sequelize.query(`SHOW COLUMNS FROM \`${table}\``))[0].map((c) => c.Field));

const ADDRESS_COLUMNS = [
    ['address_line_2', 'VARCHAR(255) NULL AFTER address_line_1'],
    ['city_name', 'VARCHAR(255) NULL AFTER city_id'],
    ['recipient_name', 'VARCHAR(255) NULL'],
    ['phone', 'VARCHAR(50) NULL'],
    ['purpose', 'VARCHAR(20) NULL'],
    ['address_type', 'VARCHAR(20) NULL'],
    ['validation_result', 'VARCHAR(20) NULL'],
    ['validated_at', 'DATETIME NULL'],
];
const ORDER_COLUMNS = [
    ['carrier', 'VARCHAR(100) NULL'],
    ['service', 'VARCHAR(150) NULL'],
    ['shippo_shipment_id', 'VARCHAR(255) NULL'],
    ['shippo_rate_id', 'VARCHAR(255) NULL'],
    ['shippo_transaction_id', 'VARCHAR(255) NULL'],
    ['label_url', 'TEXT NULL'],
    ['label_created_at', 'DATETIME NULL'],
    ['tracking_status', 'VARCHAR(30) NULL'],
    ['tracking_status_details', 'TEXT NULL'],
    ['shipped_at', 'DATETIME NULL'],
    ['delivered_at', 'DATETIME NULL'],
];

const addColumns = async (sequelize, table, columns) => {
    const have = await columnsOf(sequelize, table);
    for (const [name, definition] of columns) {
        if (!have.has(name)) await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${definition}`);
    }
};
const dropColumns = async (sequelize, table, columns) => {
    const have = await columnsOf(sequelize, table);
    for (const [name] of columns) {
        if (have.has(name)) await sequelize.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${name}\``);
    }
};

module.exports = {
    up: async ({ sequelize, log = console.log }) => {
        await addColumns(sequelize, 'user_address', ADDRESS_COLUMNS);
        await addColumns(sequelize, 'access_orders', ORDER_COLUMNS);
        const [result] = await sequelize.query(`
            UPDATE user_address SET purpose = 'shipping'
            WHERE purpose IS NULL AND id IN (SELECT user_address_id FROM business_cards WHERE user_address_id IS NOT NULL)
        `);
        log(`  Access card shipping addresses marked: ${result?.affectedRows ?? result ?? 0}`);
        await sequelize.query('CREATE INDEX IF NOT EXISTS access_orders_tracking ON access_orders (tracking_number)');
    },
    down: async ({ sequelize }) => {
        await sequelize.query('DROP INDEX IF EXISTS access_orders_tracking ON access_orders');
        await dropColumns(sequelize, 'access_orders', ORDER_COLUMNS);
        await dropColumns(sequelize, 'user_address', ADDRESS_COLUMNS);
    },
};
