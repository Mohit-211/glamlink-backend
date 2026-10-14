#!/usr/bin/env node
/**
 * Dry run of the duplicate-account merge (migration 20261015-0300) against the configured database:
 * nothing is changed. Writes one CSV row per account to review before the migration runs.
 *
 *   node scripts/merge-report.js <out.csv>
 *
 * The CSV holds real email addresses: keep it outside the repo.
 */
const fs = require('fs');
const { mergeDuplicateAccounts } = require('../src/modules/identity/accountMerge');
const sequelize = require('../src/core/db/central.db');
sequelize.options.logging = false;

const outFile = process.argv[2];
if (!outFile) {
    console.error('usage: node scripts/merge-report.js <out.csv>');
    process.exit(2);
}

const csv = (v) => (/[",\n]/.test(String(v ?? '')) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ''));
const type = (a) => (a.account_type === 'professional' ? `professional (${a.professional_type})` : a.account_type);
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

(async () => {
    const { groups, identities } = await mergeDuplicateAccounts(sequelize, { dryRun: true });
    const lines = [['group', 'email', 'action', 'account_id', 'account_type', 'sign_in', 'status', 'last_login', 'rows_moved_to_kept_account', 'rows_removed', 'notes'].join(',')];
    groups.forEach(({ accounts, report }, i) => {
        const [kept, ...merged] = accounts;
        const moved = Object.entries(report.moved).map(([k, n]) => `${k}=${n}`).join('; ');
        const removed = Object.entries(report.removed).filter(([, n]) => n).map(([k, n]) => `${k}=${n}`).join('; ');
        lines.push([i + 1, kept.email, 'keep', kept.id, type(kept), kept.provider || 'password', kept.status, day(kept.last_login), '', removed, report.notes.join(' | ')].map(csv).join(','));
        for (const a of merged) lines.push([i + 1, a.email, `merge into ${kept.id}`, a.id, type(a), a.provider || 'password', a.status, day(a.last_login), moved, '', ''].map(csv).join(','));
    });
    fs.writeFileSync(outFile, lines.join('\n') + '\n');
    const mergedCount = groups.reduce((n, g) => n + g.accounts.length - 1, 0);
    console.log(`${groups.length} emails, ${mergedCount} accounts would be merged; ${identities} Google/Apple sign-ins would be linked. Report: ${outFile}`);
    await sequelize.close();
})().catch(async (error) => {
    console.error(error);
    await sequelize.close();
    process.exit(1);
});
