// One person = one account: merges live accounts that share an email into the professional account
// (see src/shared/identity/accountMerge.js), then links Google/Apple sign-ins to the accounts that own them.
// Review `node scripts/merge-report.js <out.csv>` (a dry run) against the database first.
const { mergeDuplicateAccounts } = require('../../../shared/identity');

module.exports = {
    up: async ({ sequelize }) => {
        const { groups, identities } = await mergeDuplicateAccounts(sequelize);
        const merged = groups.reduce((n, g) => n + g.accounts.length - 1, 0);
        console.log(`  merged ${merged} accounts across ${groups.length} emails; linked ${identities} sign-ins`);
    },
    down: async () => {
        throw new Error('Merged accounts cannot be split again automatically; restore the pre-migration backup instead');
    },
};
