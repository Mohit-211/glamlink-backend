// sequelize.sync({ alter: true }) (the old `npm run migrate`) added a fresh copy of every unique index on
// each run: users had 62 identical unique indexes on referral_code, reaching MariaDB's 64-index limit and
// slowing every write to users. Drops indexes that exactly repeat another (same columns, order and
// uniqueness), keeping one: the name without a numeric suffix, else the first by name.
module.exports = {
    up: async ({ sequelize }) => {
        const [rows] = await sequelize.query(`
            SELECT table_name AS t, index_name AS i, non_unique AS nu,
                   GROUP_CONCAT(column_name ORDER BY seq_in_index) AS cols
            FROM information_schema.statistics
            WHERE table_schema = DATABASE() AND index_name <> 'PRIMARY'
            GROUP BY table_name, index_name, non_unique`);
        const sets = new Map();
        for (const r of rows) {
            const key = `${r.t}|${r.nu}|${r.cols}`;
            sets.set(key, [...(sets.get(key) || []), r]);
        }
        const preferred = (a, b) => /_\d+$/.test(a.i) - /_\d+$/.test(b.i) || a.i.localeCompare(b.i);
        for (const indexes of sets.values()) {
            if (indexes.length < 2) continue;
            const [, ...extra] = indexes.sort(preferred);
            for (const { t, i } of extra) await sequelize.query(`ALTER TABLE \`${t}\` DROP INDEX \`${i}\``);
        }
    },
    down: async () => {
        // The dropped indexes were exact copies of ones that remain: nothing to restore.
    },
};
