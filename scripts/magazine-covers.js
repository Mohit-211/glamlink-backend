#!/usr/bin/env node
/**
 * Copies magazine covers that live on another host into the API's uploads, and points each issue at its copy. The
 * migration that loaded the website's 14 issues points their covers at https://glamlink.net/magazine/<file>; run this
 * once the API runs where those files can be fetched:
 *
 *   npm run magazine:covers               copy them
 *   npm run magazine:covers -- --dry-run  list what it would copy
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const config = require('../src/core/config/config');
const { UPLOADS_DIR } = require('../src/core/config/paths');
const httpClient = require('../src/core/http/httpClient');

const IMAGE_TYPES = { jpeg: 'jpg', png: 'png', webp: 'webp', avif: 'avif' };

// Each issue whose cover is not on the API host: fetched, checked to be an image, saved as uploads/images/
// magazine-<slug>-<random>.<type>, and the issue updated. Answers [{ slug, from, to | error }].
const copyCovers = async ({ sequelize, dryRun = false, log = console.log }) => {
    const base = String(config.API_BASE_URL || '').replace(/\/+$/, '');
    const [issues] = await sequelize.query('SELECT id, slug, cover_image FROM magazine_issues WHERE cover_image IS NOT NULL ORDER BY id');
    const report = [];
    for (const issue of issues) {
        if (issue.cover_image.startsWith(`${base}/`)) continue;
        try {
            if (dryRun) {
                report.push({ slug: issue.slug, from: issue.cover_image });
                log(`would copy ${issue.slug}: ${issue.cover_image}`);
                continue;
            }
            const { data } = await httpClient.get(issue.cover_image, { responseType: 'arraybuffer', timeout: 60000 });
            const { format } = await sharp(data).metadata();
            if (!IMAGE_TYPES[format]) throw new Error(`not an image we serve (${format})`);
            const file = `magazine-${issue.slug}-${crypto.randomBytes(4).toString('hex')}.${IMAGE_TYPES[format]}`;
            fs.mkdirSync(path.join(UPLOADS_DIR, 'images'), { recursive: true });
            fs.writeFileSync(path.join(UPLOADS_DIR, 'images', file), data);
            const to = `${base}/images/${file}`;
            await sequelize.query('UPDATE magazine_issues SET cover_image = ? WHERE id = ?', { replacements: [to, issue.id] });
            report.push({ slug: issue.slug, from: issue.cover_image, to });
            log(`copied ${issue.slug}: ${to}`);
        } catch (err) {
            report.push({ slug: issue.slug, from: issue.cover_image, error: err.message });
            log(`could not copy ${issue.slug} (${issue.cover_image}): ${err.message}`);
        }
    }
    if (!report.length) log('Every cover is already on the API.');
    return report;
};

module.exports = { copyCovers };

if (require.main === module) {
    const { connect } = require('../src/core/db/migrate');
    const sequelize = connect();
    copyCovers({ sequelize, dryRun: process.argv.includes('--dry-run') })
        .then((report) => (report.some((r) => r.error) ? 1 : 0), (err) => {
            console.error(err.message);
            return 1;
        })
        .then(async (code) => {
            await sequelize.close();
            process.exit(code);
        });
}
