const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const catchAsync = require('../../core/http/catchAsync');
const { BusinessLocation, BusinessHour, BusinessGalleryMedia } = require('../../models');
const { seatOf, isPro } = require('./seats');
const { getSettings } = require('./catalog');

// What a card's owner may do on their plan (docs/access.md section 2), from the settings' entitlements:
// Free and Pro, each with photos and videos allowed, editing details and media once the card is live, the card's
// analytics. A card still a draft, waiting for review or rejected can always be edited; admins are not limited.
// Special offers are retired (Oct 23): no plan has them, and no card shows one.

const MESSAGES = {
    edit_details: 'Changing your card once it is live is part of Access Pro.',
    edit_media: 'Swapping your photos and video anytime is part of Access Pro.',
    analytics: 'Profile analytics are part of Access Pro.',
};
const upgradeRequired = (feature) =>
    ApiError.withCode(httpStatus.FORBIDDEN, MESSAGES[feature], 'UPGRADE_REQUIRED', { feature });

// The entitlements of a person (null for a guest: Free).
const entitlementsFor = async (userId) => {
    const settings = await getSettings();
    const tier = userId && isPro(await seatOf(userId)) ? 'pro' : 'free';
    return { tier, ...settings.entitlements[tier] };
};

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
    let detailsChanged = changed.length > 0;
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

// The retired special offer's fields, left in the table until a clean-up and never served. `card` is a model or a
// plain object; changed in place.
const OFFER_FIELDS = ['offer_promotion', 'promotion_details'];
const withoutOffers = (card) => {
    const values = card?.dataValues ?? card;
    if (values) for (const field of OFFER_FIELDS) delete values[field];
    return card;
};

// Cards as anyone sees them: without the retired special offer. (The name of the time offers were Pro's, kept for the
// calls in businessCard.service.js.)
const hideOffersOffPlan = async (cards) => {
    for (const card of cards) withoutOffers(card);
    return cards;
};

/**
 * Card analytics are Access Pro's (Oct 23): after requireOwnerOrAdmin, a card's owner on Free is refused with
 * UPGRADE_REQUIRED { feature: 'analytics' }; an admin always passes.
 */
const requireAnalyticsPlan = catchAsync(async (req, res, next) => {
    if (req.isAdmin) return next();
    const rights = await entitlementsFor(req.user?.id);
    if (!rights.analytics) throw upgradeRequired('analytics');
    next();
});

module.exports = { entitlementsFor, checkOwnerEdit, withoutOffers, hideOffersOffPlan, requireAnalyticsPlan, upgradeRequired };
