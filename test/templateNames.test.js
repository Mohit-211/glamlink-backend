// No counselling-template names in the schema a deploy builds (tables, columns, indexes, constraints, enum values).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startApp } = require('./helpers');

const WORDS = /counsel|cllr|beautician|zego|square_customer/i;

let app;
before(async () => { app = await startApp(); });
after(() => app.close());

test('the schema has no template names left', async () => {
    const [names] = await app.sequelize.query(`
        SELECT CONCAT('table ', table_name) AS name FROM information_schema.tables WHERE table_schema = DATABASE()
        UNION ALL SELECT CONCAT('column ', table_name, '.', column_name, ' ', column_type) FROM information_schema.columns WHERE table_schema = DATABASE()
        UNION ALL SELECT CONCAT('index ', table_name, '.', index_name) FROM information_schema.statistics WHERE table_schema = DATABASE()
        UNION ALL SELECT CONCAT('constraint ', table_name, '.', constraint_name) FROM information_schema.table_constraints WHERE table_schema = DATABASE()
    `);
    const left = names.map((r) => r.name).filter((name) => WORDS.test(name) && !name.includes('_backup'));
    assert.deepEqual(left, []);
});
