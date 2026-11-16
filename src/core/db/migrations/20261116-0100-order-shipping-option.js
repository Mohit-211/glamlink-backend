// Shipping by option (the client, Nov 16): buyers choose "Standard Shipping" or "Expedited Shipping" instead of a
// carrier and service, and an order keeps the option chosen, so its label can be bought at today's rate for that
// option. It also keeps the recipient's phone, which some carriers want on the label (checkouts had it, orders did
// not); orders paid before take theirs from their checkout.
const COLUMNS = [
    ['shipping_phone', 'VARCHAR(50) NULL AFTER shipping_country'],
    ['shipping_option', 'VARCHAR(20) NULL AFTER fulfillment_status'],
];

const columnsOf = async (sequelize) => new Set((await sequelize.query('SHOW COLUMNS FROM `access_orders`'))[0].map((c) => c.Field));

module.exports = {
    up: async ({ sequelize, log = console.log }) => {
        const have = await columnsOf(sequelize);
        for (const [name, definition] of COLUMNS) {
            if (!have.has(name)) await sequelize.query(`ALTER TABLE \`access_orders\` ADD COLUMN \`${name}\` ${definition}`);
        }
        const [result] = await sequelize.query(`
            UPDATE access_orders o JOIN access_checkouts c ON c.access_order_id = o.id
            SET o.shipping_phone = JSON_VALUE(c.shipping, '$.address.phone')
            WHERE o.shipping_phone IS NULL AND JSON_VALID(c.shipping)
                AND JSON_VALUE(c.shipping, '$.address.phone') IS NOT NULL AND JSON_VALUE(c.shipping, '$.address.phone') <> 'null'
        `);
        log(`  Orders given their checkout's phone: ${result?.affectedRows ?? result ?? 0}`);
    },
    down: async ({ sequelize }) => {
        const have = await columnsOf(sequelize);
        for (const [name] of COLUMNS) {
            if (have.has(name)) await sequelize.query(`ALTER TABLE \`access_orders\` DROP COLUMN \`${name}\``);
        }
    },
};
