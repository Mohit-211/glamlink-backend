const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('crypto');
require('./env');
const sequelize = require('../src/core/db/central.db');
const { mergeDuplicateAccounts } = require('../src/modules/identity/accountMerge');
const uniqueEmail = require('../src/core/db/migrations/20261015-0400-unique-live-email');

const q = async (sql, replacements = []) => (await sequelize.query(sql, { replacements }))[0];
const one = async (sql, replacements) => (await q(sql, replacements))[0];

let pro, user, other, reviewer;

before(async () => {
    // Duplicate live emails can only exist from before the uniqueness rule: drop it for the fixture.
    await uniqueEmail.down({ sequelize });
    await q("INSERT IGNORE INTO roles (id, name, abbreviation) VALUES (6, 'User', 'USR'), (7, 'Professional', 'PRO')");
    const make = async (email, role, type, extra = {}) => {
        const cols = { email, role_id: role, account_type: type, professional_type: role === 7 ? 'individual' : null, status: 'ACCEPTED', is_active: 1, email_verified_at: new Date(), ...extra };
        const keys = Object.keys(cols);
        const res = await q(`INSERT INTO users (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, Object.values(cols));
        const id = res.insertId ?? res;
        await q('INSERT INTO profiles (user_id, email, name, user_coin_balances) VALUES (?, ?, ?, ?)', [id, email, email, extra.coins ?? 0]);
        return id;
    };
    const email = `merge-${Date.now()}@test.example`;
    pro = await make(email, 7, 'professional');
    user = await make(email, 6, 'user', { provider: 'google', provider_id: `g-${Date.now()}` });
    other = await make(`other-${Date.now()}@test.example`, 6, 'user');
    reviewer = await make(`reviewer-${Date.now()}@test.example`, 6, 'user');
    await q('UPDATE profiles SET user_coin_balances = 5 WHERE user_id = ?', [pro]);
    await q('UPDATE profiles SET user_coin_balances = 3 WHERE user_id = ?', [user]);

    // follows: user -> pro (becomes a self-follow), other -> user and other -> pro (becomes a duplicate)
    for (const [a, b] of [[user, pro], [other, user], [other, pro]]) await q('INSERT INTO follows (follower_id, followee_id, is_active) VALUES (?, ?, 1)', [a, b]);
    // both have a profile photo; the professional's must stay
    await q("INSERT INTO user_attachments (user_id, role_id, title, file_name) VALUES (?, 7, 'Profile Image', 'pro.jpg'), (?, 6, 'Profile Image', 'user.jpg'), (?, 6, 'Album', 'x.jpg')", [pro, user, user]);
    // a review the user account wrote about the professional account, and a real one
    await q('INSERT INTO reviews (id, user_id, professional_id, level, text, is_active) VALUES (?, ?, ?, 2, ?, 1), (?, ?, ?, 5, ?, 1)',
        [randomUUID(), user, pro, 'self', randomUUID(), reviewer, pro, 'great']);
    await q('INSERT INTO feeds (user_id, is_active) VALUES (?, 1)', [user]);
});

after(async () => {
    await uniqueEmail.up({ sequelize });
    await sequelize.close();
});

test('merges the user account into the professional account', async () => {
    const { groups } = await mergeDuplicateAccounts(sequelize);
    const group = groups.find((g) => g.accounts[0].id === pro);
    assert.ok(group, 'the professional account is the one kept');

    const merged = await one('SELECT deleted_at, is_active, merged_into_user_id FROM users WHERE id = ?', [user]);
    assert.ok(merged.deleted_at);
    assert.equal(merged.is_active, 0);
    assert.equal(merged.merged_into_user_id, pro);

    // rows moved
    assert.equal((await one('SELECT COUNT(*) n FROM feeds WHERE user_id = ?', [pro])).n, 1);
    // no self-follow, no duplicate follow, counters recomputed
    assert.equal((await one('SELECT COUNT(*) n FROM follows WHERE follower_id = ? AND followee_id = ?', [pro, pro])).n, 0);
    assert.equal((await one('SELECT COUNT(*) n FROM follows WHERE follower_id = ? AND followee_id = ?', [other, pro])).n, 1);
    const profile = await one('SELECT follower_count, user_coin_balances, overall_ratings, no_of_user_rated, no_of_user_reviewed FROM profiles WHERE user_id = ? AND deleted_at IS NULL', [pro]);
    assert.equal(profile.follower_count, 1);
    assert.equal((await one('SELECT followee_count FROM profiles WHERE user_id = ?', [other])).followee_count, 1);
    // coins added together
    assert.equal(Number(profile.user_coin_balances), 8);
    // the professional's photo stays; the other attachment moves
    const photos = await q("SELECT file_name FROM user_attachments WHERE user_id = ? AND title = 'Profile Image'", [pro]);
    assert.deepEqual(photos.map((p) => p.file_name), ['pro.jpg']);
    assert.equal((await one("SELECT COUNT(*) n FROM user_attachments WHERE user_id = ? AND title = 'Album'", [pro])).n, 1);
    // the review between the two accounts is retired; the rating counts only the real review
    assert.equal(profile.overall_ratings, 5);
    assert.equal(profile.no_of_user_rated, 1);
    assert.equal(profile.no_of_user_reviewed, 1);
    // the Google sign-in now belongs to the professional account
    const identity = await one("SELECT user_id FROM user_identities WHERE provider = 'google' AND email = (SELECT email FROM users WHERE id = ?)", [pro]);
    assert.equal(identity.user_id, pro);
});

test('a second run finds nothing left to merge', async () => {
    const { groups } = await mergeDuplicateAccounts(sequelize);
    assert.equal(groups.length, 0);
});
