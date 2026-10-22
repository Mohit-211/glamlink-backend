const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const { Op } = require('sequelize');
const sequelize = require('../../core/db/central.db');
const logger = require('../../core/logger');
const { UPLOADS_DIR } = require('../../core/config/paths');
const { BusinessCard, BusinessLocation, BusinessHour, BusinessGalleryMedia, ProfilePage } = require('../../models');
const { readCard } = require('./cardFields');
const { planMedia } = require('./cardMedia');
const { checkOwnerEdit, checkNewCard } = require('./entitlements');
const { publicLink, qrUrl, slugOf } = require('./cardLinks');
const { geocodeCard } = require('./cardGeocode');

// Writing a card: one path for every way a card is created or edited (the website's guest and signed-in forms,
// the admin panel), so the same fields and checks apply everywhere (docs/access.md section 1).

// Photos and videos a card may hold when no plan says otherwise: the pricing page's "up to 4 photos" and
// "1 featured video" (the settings' entitlements give each plan's).
const MEDIA_LIMITS = { photos: 4, videos: 1 };
const limitsOf = (rights) => (rights ? { photos: rights.photos, videos: rights.videos } : MEDIA_LIMITS);


// A free public link: the card's name in lowercase letters and digits, numbered when taken. Links of deleted
// cards stay taken, so a printed QR code never leads to someone else's card; so does another account's profile page.
const freeSlug = async (card, transaction) => {
    const base = (card.name || card.business_name || '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'business';
    for (let n = 0; ; n++) {
        const slug = n ? `${base}-${n}` : base;
        const taken = await BusinessCard.findOne({
            where: { slug, id: { [Op.ne]: card.id } },
            attributes: ['id'],
            paranoid: false,
            transaction,
        }) || await ProfilePage.findOne({
            where: { slug, user_id: { [Op.ne]: card.user_id || 0 } },
            attributes: ['user_id'],
            transaction,
        });
        if (!taken) return slug;
    }
};

// Draws the card's QR code (its public link) into uploads/images/qr/<slug>.png.
const drawQrCode = (link) => {
    const dir = path.join(UPLOADS_DIR, 'images', 'qr');
    fs.mkdirSync(dir, { recursive: true });
    return QRCode.toFile(path.join(dir, `${slugOf(link)}.png`), link);
};

// The card's locations, hours and gallery as the request sets them (undefined leaves them alone).
const saveDetails = async (cardId, { locations, hours, media }, transaction) => {
    if (locations) {
        await BusinessLocation.destroy({ where: { business_card_id: cardId }, transaction });
        await BusinessLocation.bulkCreate(locations.map((row) => ({ ...row, business_card_id: cardId })), { transaction });
    }
    if (hours) {
        await BusinessHour.destroy({ where: { business_card_id: cardId }, transaction });
        if (hours.length) {
            await BusinessHour.bulkCreate(
                hours.map(({ note }) => ({ business_card_id: cardId, day: null, is_closed: true, open_time: null, close_time: null, note })),
                { transaction },
            );
        }
    }
    if (media.removeIds.length) await BusinessGalleryMedia.destroy({ where: { id: media.removeIds, business_card_id: cardId }, transaction });
    for (const { id, ...meta } of media.update) {
        await BusinessGalleryMedia.update(meta, { where: { id, business_card_id: cardId }, transaction });
    }
    if (media.add.length) {
        await BusinessGalleryMedia.bulkCreate(media.add.map((row) => ({ ...row, business_card_id: cardId })), { transaction });
    }
};

/**
 * A new card from a request's fields and files. `attributes` come from the caller, never the request:
 * user_id, status, plan_type, nfc_status, created_by_admin and the like. `prepare(transaction)` runs first in the
 * same transaction and returns more attributes (the ownership checks; a public link the card takes over).
 * `rights` are the maker's entitlements (entitlements.js; an admin's allow everything). Returns the saved card.
 */
const createCard = async ({ body, files, attributes = {}, prepare, rights }) => {
    const { card, locations, hours } = readCard(body, { files });
    if (rights) checkNewCard(card, rights);
    const media = planMedia({ files, body, creating: true, limits: limitsOf(rights) });
    const cardDoc = await sequelize.transaction(async (transaction) => {
        const more = prepare ? await prepare(transaction) : {};
        const doc = await BusinessCard.create({ ...card, profile_image: media.profileImage, ...attributes, ...more }, { transaction });
        await saveDetails(doc.id, { locations, hours, media }, transaction);
        if (!doc.business_card_link) {
            const slug = await freeSlug(doc, transaction);
            await doc.update({ business_card_link: publicLink(slug), business_card_qr: qrUrl(slug) }, { transaction });
        }
        return doc;
    });
    // Drawn after the card is saved: the card already holds the QR code's URL.
    drawQrCode(cardDoc.business_card_link).catch((err) => logger.error(`QR code for card ${cardDoc.id}`, err));
    geocodeCard(cardDoc.id);
    return cardDoc;
};

/**
 * Applies an edit request to a card: only the fields and media in the request change. `rights` are the owner's
 * entitlements; with `byOwner` an edit of a live card their plan does not allow is refused (UPGRADE_REQUIRED).
 * Returns the card.
 */
const updateCard = async (cardDoc, { body, files, rights, byOwner = false }) => {
    const existing = await BusinessGalleryMedia.findAll({
        where: { business_card_id: cardDoc.id },
        attributes: ['id', 'file_type', 'sort_order'],
    });
    const { card, locations, hours } = readCard(body, { current: cardDoc.get({ plain: true }), files });
    const media = planMedia({ files, body, existing, creating: false, limits: limitsOf(rights) });
    if (byOwner && rights) await checkOwnerEdit(cardDoc, { card, locations, hours, media }, rights);
    await sequelize.transaction(async (transaction) => {
        await cardDoc.update({ ...card, ...(media.profileImage && { profile_image: media.profileImage }) }, { transaction });
        await saveDetails(cardDoc.id, { locations, hours, media }, transaction);
    });
    if (locations) geocodeCard(cardDoc.id);
    return cardDoc;
};

module.exports = { createCard, updateCard, MEDIA_LIMITS, publicLink, slugOf };
