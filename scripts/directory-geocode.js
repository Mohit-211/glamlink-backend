#!/usr/bin/env node
/**
 * Coordinates for the directory's distance search: the locations of live Access cards and the directory applications
 * (pending or approved) that have none are geocoded from their address, or their city and state. New ones are
 * geocoded when saved; run this once for those saved before (only 58 of 302 card locations had coordinates on Oct
 * 22). Needs GOOGLE_API_KEY (Geocoding); about $5 per 1,000 addresses.
 *
 *   npm run directory:geocode
 */
const { Op, literal } = require('sequelize');
const config = require('../src/core/config/config');
const { DirectoryApplication } = require('../src/models');
const { geocodeLocations } = require('../src/website/access-card');
const { geocodeApplication } = require('../src/website/inquiries');
const sequelize = require('../src/core/db/central.db');

const main = async () => {
    if (!config.GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY is not set');
    const cards = await geocodeLocations({
        business_card_id: { [Op.in]: literal("(SELECT id FROM business_cards WHERE status = 'accepted' AND is_active = 1 AND deleted_at IS NULL)") },
    });
    console.log(`card locations: ${cards.geocoded} geocoded, ${cards.missed} not found (check their address)`);
    const applications = await DirectoryApplication.findAll({ where: { status: ['pending', 'approved'], latitude: null } });
    let found = 0;
    for (const application of applications) {
        await geocodeApplication(application);
        if (application.latitude !== null) found++;
    }
    console.log(`directory applications: ${found} of ${applications.length} geocoded`);
};

main()
    .then(() => 0, (err) => {
        console.error(err.message);
        return 1;
    })
    .then(async (code) => {
        await sequelize.close();
        process.exit(code);
    });
