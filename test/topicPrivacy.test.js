// The public topic page (GET /journal/topic/:id) does not show professionals' emails; admins still see them.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { startApp } = require('./helpers');

let app, topicId, adminToken;
const email = `topic-pro-${Date.now()}@test.example`;

before(async () => {
    app = await startApp();
    const insert = async (sql, replacements = []) => { const res = (await app.sequelize.query(sql, { replacements }))[0]; return res.insertId ?? res; };
    await insert("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (1, 'Super Admin', 'SUP_ADM'), (7, 'Professional', 'PRO')");
    const pro = await insert("INSERT INTO users (email, role_id, account_type, professional_type, status, is_active, email_verified_at) VALUES (?, 7, 'professional', 'individual', 'ACCEPTED', 1, NOW())", [email]);
    await insert('INSERT INTO profiles (user_id, email, name) VALUES (?, ?, ?)', [pro, email, 'Topic Pro']);
    topicId = await insert("INSERT INTO journal_topics (name, slug) VALUES ('Skin care', ?)", [`skin-care-${Date.now()}`]);
    await insert('INSERT INTO journal_topic_professional_mappings (topic_id, user_id) VALUES (?, ?)', [topicId, pro]);
    const admin = await insert("INSERT INTO admins (name, email, role_id, is_active) VALUES ('Topic Admin', ?, 1, 1)", [`topic-admin-${Date.now()}@test.example`]);
    adminToken = jwt.sign({ id: admin, role_id: 1, is_backlisted: false }, Buffer.from(process.env.JWT_SECRET, 'hex'), { algorithm: 'HS256', expiresIn: '1h' });
});
after(() => app.close());

test('the public topic page lists the professional without their email', async () => {
    const res = await app.request('GET', `/api/v1/journal/topic/${topicId}`);
    assert.equal(res.status, 200);
    const [pro] = res.body.data.professionals;
    assert.ok(pro, 'the professional is listed');
    assert.equal(pro.email, undefined);
    assert.ok(!JSON.stringify(res.body).includes(email), 'the email appears nowhere in the response');
});

test('an admin sees the email', async () => {
    const res = await app.request('GET', `/api/v1/journal/topic/${topicId}`, { headers: { Authorization: `Bearer ${adminToken}` } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.professionals[0].email, email);
});
