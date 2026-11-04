#!/usr/bin/env node
/**
 * Lists the cards whose public link (and so its QR code) names another website than WEBSITE_URL: the ones made on
 * the test site before the switch to glamlink.net. With --apply, moves each link to WEBSITE_URL and draws its QR
 * code again (docs/deploy.md section 8).
 *
 *   node scripts/card-links.js [--apply]
 */
process.loadEnvFile(require('path').join(__dirname, '..', '.env'));
const config = require('../src/core/config/config');
const { relinkCards } = require('../src/website/access-card/cardWriter');
const sequelize = require('../src/core/db/central.db');

const apply = process.argv.includes('--apply');

(async () => {
    const cards = await relinkCards({ apply });
    for (const card of cards) console.log(`card ${card.id} (${card.status}): ${card.from} -> ${card.to}`);
    if (!cards.length) console.log(`Every card links to ${config.WEBSITE_URL}.`);
    else if (apply) console.log(`\n${cards.length} cards now link to ${config.WEBSITE_URL}, with new QR codes.`);
    else console.log(`\n${cards.length} cards link elsewhere. Delete the test ones in the admin panel, then run again with --apply.`);
    await sequelize.close();
})().catch(async (err) => {
    console.error(err.message);
    await sequelize.close();
    process.exit(1);
});
