#!/usr/bin/env node
/**
 * Contract check: records or compares real API responses against the local database copy,
 * so refactors can prove they changed no behaviour.
 *
 *   node scripts/contract-check.js record  <snapshot.json>
 *   node scripts/contract-check.js compare <snapshot.json>
 *
 * Needs the repo .env pointing at a local copy of production. Snapshots contain real data:
 * keep them outside the repo. Cron jobs are disabled while it runs, and the sign-in session it creates
 * for the card owner is deleted afterwards.
 */
const path = require('path');
const fs = require('fs');
const Module = require('module');

const [mode, snapshotFile] = process.argv.slice(2);
if (!['record', 'compare'].includes(mode) || !snapshotFile) {
    console.error('usage: node scripts/contract-check.js record|compare <snapshot.json>');
    process.exit(2);
}

const ROOT = path.resolve(__dirname, '..');
process.loadEnvFile(path.join(ROOT, '.env'));

// No cron jobs: they would change data between runs.
const originalLoad = Module._load;
Module._load = function (request) {
    if (request === 'node-cron') return { schedule: () => ({}) };
    return originalLoad.apply(this, arguments);
};

const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

// Fields that legitimately differ between runs.
const VOLATILE = new Set(['time_ago', 'expires', 'token']);
const normalize = (v) => {
    if (Array.isArray(v)) return v.map(normalize);
    if (v && typeof v === 'object') {
        const out = {};
        for (const k of Object.keys(v).sort()) out[k] = VOLATILE.has(k) ? '<volatile>' : normalize(v[k]);
        return out;
    }
    return v;
};

// Where two bodies differ: "removed a.b", "added a.c", "changed a.d". Array items are compared by index,
// and paths are reported once per shape (array indexes shown as []).
const diffPaths = (a, b, p = '', out = new Set()) => {
    const isObj = (v) => v && typeof v === 'object';
    if (isObj(a) && isObj(b)) {
        for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
            const q = Array.isArray(a) ? `${p}[]` : p ? `${p}.${k}` : k;
            if (!(k in b)) out.add(`removed ${q}`);
            else if (!(k in a)) out.add(`added ${q}`);
            else diffPaths(a[k], b[k], q, out);
        }
    } else if (JSON.stringify(a) !== JSON.stringify(b)) out.add(`changed ${p || '(body)'}`);
    return [...out];
};

(async () => {
    const db = await mysql.createConnection({
        host: process.env.CENTRAL_MYSQL_HOST, port: Number(process.env.CENTRAL_MYSQL_PORT),
        user: process.env.CENTRAL_MYSQL_USER, password: process.env.CENTRAL_MYSQL_PASSWORD, database: process.env.CENTRAL_MYSQL_DB,
    });
    const one = async (sql) => (await db.query(sql))[0][0] || {};

    // Real ids to call the endpoints with.
    const card = await one("SELECT bc.id, bc.user_id, SUBSTRING_INDEX(bc.business_card_link, '/', -1) AS slug FROM business_cards bc JOIN users u ON u.id = bc.user_id WHERE u.is_active = 1 AND bc.is_active = 1 ORDER BY bc.id LIMIT 1");
    const journal = await one('SELECT id, category_id FROM journals WHERE is_active = 1 ORDER BY id LIMIT 1');
    const topic = await one('SELECT id FROM journal_topics ORDER BY id LIMIT 1');
    const ids = {
        card: card.id, owner: card.user_id, slug: card.slug, journal: journal.id, journalCategory: journal.category_id, topic: topic.id,
        author: (await one('SELECT id FROM authors ORDER BY id LIMIT 1')).id,
        podcast: (await one('SELECT id FROM podcast_schedules ORDER BY id LIMIT 1')).id,
        shop: (await one('SELECT id FROM shops WHERE is_active = 1 ORDER BY id LIMIT 1')).id,
        ad: (await one('SELECT id FROM ads ORDER BY id LIMIT 1')).id,
        directory: (await one('SELECT id FROM directories ORDER BY id LIMIT 1')).id,
        cardCategory: (await one('SELECT id FROM business_card_categories ORDER BY id LIMIT 1')).id,
        accessOrder: (await one('SELECT id FROM access_orders ORDER BY id LIMIT 1')).id,
        product: (await one('SELECT id FROM products ORDER BY id LIMIT 1')).id,
        admin: (await one('SELECT id FROM admins WHERE is_active = 1 ORDER BY id LIMIT 1')).id,
    };

    const secret = process.env.JWT_SECRET;
    const tokens = {
        admin: jwt.sign({ id: ids.admin, role_id: 1, department_id: 1, is_backlisted: false }, Buffer.from(secret, 'hex'), { algorithm: 'HS256', expiresIn: '1h' }),
    };

    const P = '/api/v1';
    const endpoints = [
        // Website, public
        ['public', `${P}/journal`], [`public`, `${P}/journal/findJournalById/${ids.journal}`], ['public', `${P}/journal/${ids.journalCategory}`],
        ['public', `${P}/journal/faq`], ['public', `${P}/journal/topic`], ['public', `${P}/journal/topic/${ids.topic}`],
        ['public', `${P}/journal/${ids.journal}/faqs`], ['public', `${P}/journal/${ids.journal}/topics`], ['public', `${P}/journal/topic/${ids.topic}/paragraphs`],
        ['public', `${P}/journalCategory`], ['public', `${P}/journalCategory/${ids.journalCategory}`], ['public', `${P}/author`], ['public', `${P}/author/${ids.author}`],
        ['public', `${P}/podcast-schedule/list`], ['public', `${P}/podcast-schedule/${ids.podcast}`],
        ['public', `${P}/discover/shop`], ['public', `${P}/discover/education`], ['public', `${P}/discover/event`], ['public', `${P}/discover/shop/findById/${ids.shop}`],
        ['public', `${P}/ads`], ['public', `${P}/ads/findAdById/${ids.ad}`],
        ['public', `${P}/businessCard/getAllProfiles`], ['public', `${P}/businessCard/getAllDirectories`], ['public', `${P}/businessCard/getProfilesByDirectory/${ids.directory}`],
        ['public', `${P}/businessCard/getAllCategories`], ['public', `${P}/businessCard/findCategoryById/${ids.cardCategory}`],
        ['public', `${P}/businessCard/getBusinessCard/${ids.slug}`], ['public', `${P}/businessCard/getBusinessCardById/${ids.card}`],
        ['public', `${P}/businessCard/search?search=a`], ['public', `${P}/businessCard/filter?location=a`],
        ['public', `${P}/faq`], ['public', `${P}/form/getAllQuestions`], ['public', `${P}/blog`], ['public', `${P}/blog-category`],
        ['public', `${P}/country`], ['public', `${P}/category`], ['public', `${P}/profession`], ['public', `${P}/language`],
        ['public', `${P}/promotion/getAllKeywords`], ['public', `${P}/product/getProductById/${ids.product}`], ['public', `${P}/banner/getAllBanner`],
        ['public', `${P}/user/auth/sso`, 'POST'],
        // Admin panel
        ['admin', `${P}/journal/admin`], ['admin', `${P}/discover/shop/admin`], ['admin', `${P}/businessCard/getAllBusinessCards`],
        ['admin', `${P}/businessCard/access-orders`], ['admin', `${P}/businessCard/access-orders/${ids.accessOrder}`],
        ['admin', `${P}/contactUs/all`], ['admin', `${P}/guest-application/list`], ['admin', `${P}/partnership-inquiry`],
        ['admin', `${P}/admin/list`], ['admin', `${P}/admin/users/list/7`], ['admin', `${P}/admin/users/getUserById/${ids.owner}`],
        ['admin', `${P}/admin/dashboard/getUserCount`], ['admin', `${P}/admin/dashboard/getProfessionalsCount`],
        ['admin', `${P}/access-card/analytics/overview`], ['admin', `${P}/form/getUsersWhoSubmittedForm`],
        ['admin', `${P}/product/getAllProductsForAdmin`], ['admin', `${P}/order/getAllOrders`], ['admin', `${P}/admin/permissions`],
        // Professional (card owner)
        ['owner', `${P}/businessCard/getMyBusinessCard`], ['owner', `${P}/user/profile`], ['owner', `${P}/access-card/analytics/${ids.card}`],
        ['owner', `${P}/access-card/analytics/${ids.card}/events`], ['owner', `${P}/businessCard/payment-history`],
        // Guards
        ['public', `${P}/journal/admin`], ['owner', `${P}/businessCard/getAllBusinessCards`],
    ];

    const app = require(path.join(ROOT, 'app.js'));
    const { createSession, revokeSession } = require(path.join(ROOT, 'src/core/auth/sessions'));
    const ownerSession = await createSession({ id: ids.owner }, { client: 'contract-check' });
    tokens.owner = ownerSession.tokens.access_token;
    const server = app.listen(0, '127.0.0.1');
    await new Promise((r) => server.once('listening', r));
    const base = `http://127.0.0.1:${server.address().port}`;

    const results = {};
    for (const [who, url, method = 'GET'] of endpoints) {
        const res = await fetch(base + url, { method, headers: who === 'public' ? {} : { 'x-access-token': tokens[who] } });
        const text = await res.text();
        let body; try { body = normalize(JSON.parse(text)); } catch (e) { body = text; }
        results[`${method} ${url} as ${who}`] = { status: res.status, body };
    }

    await revokeSession(ownerSession.session.id, 'contract_check');
    await db.query('DELETE FROM auth_sessions WHERE id = ?', [ownerSession.session.id]);
    await db.end();
    server.close();

    let exitCode = 0;
    if (mode === 'record') {
        fs.writeFileSync(snapshotFile, JSON.stringify(results, null, 1));
        const bad = Object.entries(results).filter(([, r]) => r.status >= 500);
        console.log(`recorded ${Object.keys(results).length} endpoints to ${snapshotFile}${bad.length ? `; ${bad.length} return 5xx: ${bad.map(([k]) => k).join(', ')}` : ''}`);
    } else {
        const expected = JSON.parse(fs.readFileSync(snapshotFile, 'utf8'));
        const diffs = [];
        for (const key of new Set([...Object.keys(expected), ...Object.keys(results)])) {
            if (JSON.stringify(expected[key]) !== JSON.stringify(results[key])) diffs.push(key);
        }
        if (diffs.length) {
            exitCode = 1;
            console.log(`CONTRACT CHANGED for ${diffs.length} endpoint(s):`);
            for (const k of diffs) {
                console.log(`  ${k}: status ${expected[k] && expected[k].status} -> ${results[k] && results[k].status}`);
                const changes = diffPaths(expected[k] && expected[k].body, results[k] && results[k].body);
                for (const c of changes.slice(0, 15)) console.log(`    ${c}`);
                if (changes.length > 15) console.log(`    ... ${changes.length - 15} more`);
            }
        } else {
            console.log(`contract identical for all ${Object.keys(results).length} endpoints`);
        }
    }
    setTimeout(() => process.exit(exitCode), 200);
})().catch((e) => { console.error(e); process.exit(1); });
