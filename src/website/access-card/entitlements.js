const { Op } = require('sequelize');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const { AccessSubscription, BusinessLocation, BusinessHour, BusinessGalleryMedia } = require('../../models');
const { seatOf, isPro, PRO_STATUSES } = require('./seats');
const { getSettings } = require('./catalog');

// What a card's owner may do on their plan (docs/access.md section 2), from the settings' entitlements:
// Free and Pro, each with photos and videos allowed, editing details and media once the card is live, special
// offers. A card still a draft, waiting for review or rejected can always be edited; admins are not limited.

const MESSAGES = {
    edit_details: 'Changing your card once it is live is part of Access Pro.',
    edit_media: 'Swapping your photos and video anytime is part of Access Pro.',
    special_offers: 'Special offers are part of Access Pro.',
};
const upgradeRequired = (feature) =>
    ApiError.withCode(httpStatus.FORBIDDEN, MESSAGES[feature], 'UPGRADE_REQUIRED', { feature });

// The entitlements of a person (null for a guest: Free).
const entitlementsFor = async (userId) => {
    const settings = await getSettings();
    const tier = userId && isPro(await seatOf(userId)) ? 'pro' : 'free';
    return { tier, ...settings.entitlements[tier] };
};

const OFFER_FIELDS = ['offer_promotion', 'promotion_details'];

const comparable = (value) => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'string') {
        try {
            return JSON.stringify(JSON.parse(value));
        } catch {
            return value.trim();
        }
    }
    if (typeof value === 'boolean' || typeof value === 'number') return String(value === true ? 1 : value === false ? 0 : value);
    return JSON.stringify(value);
};

// The fields an edit really changes (the website sends the whole form every time).
const changedFields = (changes, current) =>
    Object.keys(changes).filter((key) => comparable(changes[key]) !== comparable(current[key]));

const sameRows = (rows, stored, keys) => JSON.stringify(rows.map((r) => keys.map((k) => comparable(r[k])))) === JSON.stringify(stored.map((r) => keys.map((k) => comparable(r[k]))));

const LOCATION_KEYS = ['label', 'location_type', 'address', 'city', 'state', 'latitude', 'longitude', 'is_primary'];

/**
 * Refuses an owner's edit of a live card that their plan does not allow: UPGRADE_REQUIRED naming the feature.
 * `edit` is what cardWriter read from the request: { card, locations, hours, media }.
 */
const checkOwnerEdit = async (cardDoc, edit, rights) => {
    if (cardDoc.status !== 'accepted') return;
    const current = cardDoc.get({ plain: true });
    const changed = changedFields(edit.card, current);

    if (!rights.special_offers && changed.some((key) => OFFER_FIELDS.includes(key)) && (edit.card.offer_promotion ?? current.offer_promotion)) {
        throw upgradeRequired('special_offers');
    }

    const { media } = edit;
    let mediaChanged = Boolean(media.profileImage) || media.add.length > 0 || media.removeIds.length > 0;
    if (!mediaChanged && media.update.length) {
        const stored = await BusinessGalleryMedia.findAll({ where: { id: media.update.map((u) => u.id) }, attributes: ['id', 'caption', 'is_thumbnail'] });
        mediaChanged = media.update.some((u) => {
            const row = stored.find((s) => String(s.id) === String(u.id));
            return !row || comparable(row.caption) !== comparable(u.caption) || Boolean(row.is_thumbnail) !== Boolean(u.is_thumbnail);
        });
    }
    if (!rights.edit_media && mediaChanged) throw upgradeRequired('edit_media');

    if (rights.edit_details) return;
    let detailsChanged = changed.some((key) => !OFFER_FIELDS.includes(key));
    if (!detailsChanged && edit.locations) {
        const stored = await BusinessLocation.findAll({ where: { business_card_id: cardDoc.id }, order: [['sort_order', 'ASC']] });
        detailsChanged = !sameRows(edit.locations, stored, LOCATION_KEYS);
    }
    if (!detailsChanged && edit.hours) {
        const stored = await BusinessHour.findAll({ where: { business_card_id: cardDoc.id }, order: [['id', 'ASC']] });
        detailsChanged = !sameRows(edit.hours, stored, ['note']);
    }
    if (detailsChanged) throw upgradeRequired('edit_details');
};

// A new card's special offer needs Pro (an admin may set one).
const checkNewCard = (card, rights) => {
    if (card.offer_promotion && !rights.special_offers) throw upgradeRequired('special_offers');
};

/**
 * Public cards show a special offer only while their owner's plan includes offers. `cards` are plain objects with
 * user_id (before cardPublic.js removes it); changed in place.
 */
const hideOffersOffPlan = async (cards) => {
    const list = cards.filter((card) => card && card.offer_promotion);
    if (!list.length) return cards;
    const settings = await getSettings();
    if (settings.entitlements.free.special_offers) return cards;
    const ownerIds = [...new Set(list.map((card) => card.user_id).filter(Boolean))];
    const pro = settings.entitlements.pro.special_offers && ownerIds.length
        ? new Set((await AccessSubscription.findAll({ where: { user_id: { [Op.in]: ownerIds }, status: PRO_STATUSES }, attributes: ['user_id'] })).map((s) => String(s.user_id)))
        : new Set();
    for (const card of list) {
        if (!pro.has(String(card.user_id))) {
            card.offer_promotion = false;
            card.promotion_details = null;
        }
    }
    return cards;
};

module.exports = { entitlementsFor, checkOwnerEdit, checkNewCard, hideOffersOffPlan, upgradeRequired };
