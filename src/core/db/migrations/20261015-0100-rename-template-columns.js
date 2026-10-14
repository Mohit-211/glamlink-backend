// Phase 2d renamed the counselling template's names in code; this renames the columns to match and drops
// the template's unused columns. RENAME COLUMN keeps each column's type, data, indexes and foreign keys.

const RENAMES = [
    ['appointments', 'counselor_id', 'professional_id'],
    ['appointments', 'is_counselor_joined', 'is_professional_joined'],
    ['appointments', 'is_counselor_canceled', 'is_professional_canceled'],
    ['availability', 'counselor_id', 'professional_id'],
    ['bookings', 'counselor_id', 'professional_id'],
    ['bookings', 'is_counselor_joined', 'is_professional_joined'],
    ['bookings', 'is_counselor_canceled', 'is_professional_canceled'],
    ['booking_slots', 'counselor_id', 'professional_id'],
    ['cases', 'counselor_id', 'professional_id'],
    ['intervals', 'counselor_id', 'professional_id'],
    ['reviews', 'counselor_id', 'professional_id'],
    ['rules', 'counselor_id', 'professional_id'],
    ['slots', 'counselor_id', 'professional_id'],
    ['profiles', 'no_of_beautician_associated', 'no_of_professionals_associated'],
];

// Video calls (Zego) and Square payments were never part of Glamlink. All empty except call_type, which is
// 'VIDEO' on every row. `down` re-adds them empty.
const VIDEO_CALL_COLUMNS = [
    ['call_type', "ENUM('VIDEO','VOICE') NULL DEFAULT 'VIDEO'"],
    ['counselor_zego_id', 'INT NULL'],
    ['user_zego_id', 'INT NULL'],
    ['zego_call_id', 'VARCHAR(200) NULL'],
    ['call_end_by', "ENUM('User','Counselor') NULL"],
    ['call_start_time', 'DATETIME NULL'],
    ['call_end_time', 'DATETIME NULL'],
    ['call_duration_in_minuites', 'INT NULL'],
];
const DROPS = [
    ...['bookings', 'appointments'].flatMap((table) => VIDEO_CALL_COLUMNS.map(([column, type]) => [table, column, type])),
    ['users', 'square_customer_id', 'VARCHAR(200) NULL'],
];

const columnsOf = async (sequelize, table) => {
    const [rows] = await sequelize.query(
        'SELECT column_name AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?',
        { replacements: [table] },
    );
    return new Set(rows.map((r) => r.c));
};
const tableExists = async (sequelize, table) => (await columnsOf(sequelize, table)).size > 0;

module.exports = {
    up: async ({ sequelize }) => {
        for (const [table, from, to] of RENAMES) {
            if ((await columnsOf(sequelize, table)).has(from)) await sequelize.query(`ALTER TABLE \`${table}\` RENAME COLUMN \`${from}\` TO \`${to}\``);
        }
        for (const [table, column] of DROPS) {
            if ((await columnsOf(sequelize, table)).has(column)) await sequelize.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
        }
        if (await tableExists(sequelize, 'professiona_payouts')) await sequelize.query('RENAME TABLE professiona_payouts TO professional_payouts');
    },
    down: async ({ sequelize }) => {
        if (await tableExists(sequelize, 'professional_payouts')) await sequelize.query('RENAME TABLE professional_payouts TO professiona_payouts');
        for (const [table, column, type] of DROPS) {
            if (!(await columnsOf(sequelize, table)).has(column)) await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}`);
        }
        for (const [table, from, to] of RENAMES) {
            if ((await columnsOf(sequelize, table)).has(to)) await sequelize.query(`ALTER TABLE \`${table}\` RENAME COLUMN \`${to}\` TO \`${from}\``);
        }
    },
};
