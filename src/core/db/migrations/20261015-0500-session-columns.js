// Columns that follow sign-ins from the old user_tokens to auth_sessions:
// - auth_sessions.push_token: the app's push-notification token (Firebase) belongs to a signed-in device,
//   so signing out stops that device's notifications.
// - user_login_timings.session_id: which session a login/logout time belongs to (token_id pointed at
//   user_tokens and stays for the older rows).
const ADD = [
    ['auth_sessions', 'push_token', 'VARCHAR(500) NULL AFTER client'],
    ['user_login_timings', 'session_id', 'BIGINT UNSIGNED NULL AFTER token_id'],
];

const has = async (sequelize, table, column) => (await sequelize.query(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`))[0].length > 0;

module.exports = {
    up: async ({ sequelize }) => {
        for (const [table, column, definition] of ADD) {
            if (!(await has(sequelize, table, column))) await sequelize.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
        }
        const [indexes] = await sequelize.query("SHOW INDEX FROM user_login_timings WHERE Key_name = 'idx_user_login_timings_session'");
        if (!indexes.length) await sequelize.query('ALTER TABLE user_login_timings ADD KEY idx_user_login_timings_session (session_id)');
    },
    down: async ({ sequelize }) => {
        const [indexes] = await sequelize.query("SHOW INDEX FROM user_login_timings WHERE Key_name = 'idx_user_login_timings_session'");
        if (indexes.length) await sequelize.query('ALTER TABLE user_login_timings DROP KEY idx_user_login_timings_session');
        for (const [table, column] of ADD) {
            if (await has(sequelize, table, column)) await sequelize.query(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``);
        }
    },
};
