// The Access payment flow made whole (Nov 1). A checkout can be processing (the bank is confirming the payment) or
// cancelled (a newer quote replaced it, or an admin cancelled its order), and remembers when Stripe was last asked about
// it. An order can be cancelled by an admin, and shows what Stripe reports of refunds and disputes (both are made in
// Stripe's dashboard, never by the API); a payment can be refunded or disputed. A seat remembers when its renewal
// started failing and when a payment last failed. A Stripe event's claim is marked done once the event is processed.
const columnsOf = async (sequelize, table) =>
    new Set((await sequelize.query(`SHOW COLUMNS FROM \`${table}\``))[0].map((c) => c.Field));

const COLUMNS = {
    access_checkouts: [['synced_at', 'DATETIME NULL AFTER paid_at']],
    access_orders: [
        ['cancelled_at', 'DATETIME NULL'],
        ['cancel_reason', 'VARCHAR(500) NULL'],
        ['refunded_amount', 'DECIMAL(10,2) NULL'],
        ['refunded_at', 'DATETIME NULL'],
        ['dispute_status', 'VARCHAR(40) NULL'],
        ['disputed_at', 'DATETIME NULL'],
    ],
    access_subscriptions: [
        ['past_due_since', 'DATETIME NULL AFTER ended_at'],
        ['last_payment_failed_at', 'DATETIME NULL AFTER past_due_since'],
    ],
    stripe_events: [['processed_at', 'DATETIME NULL']],
};

// New values go at the end of each list (MariaDB then changes only the table's definition).
const ENUMS = [
    ['access_checkouts', 'status', "ENUM('open','pending','paid','failed','expired','processing','cancelled') NOT NULL DEFAULT 'open'",
        "ENUM('open','pending','paid','failed','expired') NOT NULL DEFAULT 'open'",
        "UPDATE access_checkouts SET status = CASE status WHEN 'processing' THEN 'pending' ELSE 'expired' END WHERE status IN ('processing','cancelled')"],
    ['access_orders', 'payment_status', "ENUM('paid','failed','refunded','partially_refunded','disputed') NOT NULL DEFAULT 'paid'",
        "ENUM('paid','failed','refunded') NOT NULL DEFAULT 'paid'",
        "UPDATE access_orders SET payment_status = 'paid' WHERE payment_status IN ('partially_refunded','disputed')"],
    ['access_orders', 'fulfillment_status', "ENUM('pending','processing','shipped','delivered','cancelled') NULL DEFAULT NULL",
        "ENUM('pending','processing','shipped','delivered') NULL DEFAULT NULL",
        "UPDATE access_orders SET fulfillment_status = 'pending' WHERE fulfillment_status = 'cancelled'"],
    ['payments', 'payment_status', "ENUM('PENDING','SUCCESS','REJECTED','CANCELLED','REFUNDED','DISPUTED') NOT NULL DEFAULT 'PENDING'",
        "ENUM('PENDING','SUCCESS','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING'",
        "UPDATE payments SET payment_status = 'SUCCESS' WHERE payment_status IN ('REFUNDED','DISPUTED')"],
];

module.exports = {
    up: async ({ sequelize }) => {
        for (const [table, column, definition] of ENUMS) {
            await sequelize.query(`ALTER TABLE \`${table}\` MODIFY \`${column}\` ${definition}`);
        }
        for (const [table, columns] of Object.entries(COLUMNS)) {
            const have = await columnsOf(sequelize, table);
            for (const [name, definition] of columns) {
                if (!have.has(name)) await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${name}\` ${definition}`);
            }
        }
        // Events claimed before today were processed (or are long past Stripe's retries).
        await sequelize.query('UPDATE stripe_events SET processed_at = created_at WHERE processed_at IS NULL');
        await sequelize.query('CREATE INDEX IF NOT EXISTS access_checkouts_status ON access_checkouts (status, synced_at)');
    },
    down: async ({ sequelize }) => {
        await sequelize.query('DROP INDEX IF EXISTS access_checkouts_status ON access_checkouts');
        for (const [table, columns] of Object.entries(COLUMNS)) {
            const have = await columnsOf(sequelize, table);
            for (const [name] of columns) {
                if (have.has(name)) await sequelize.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${name}\``);
            }
        }
        for (const [table, column, , before, backfill] of ENUMS) {
            await sequelize.query(backfill);
            await sequelize.query(`ALTER TABLE \`${table}\` MODIFY \`${column}\` ${before}`);
        }
    },
};
