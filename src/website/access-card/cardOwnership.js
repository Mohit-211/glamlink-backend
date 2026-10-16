const { Op } = require('sequelize');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const sequelize = require('../../core/db/central.db');
const { BusinessCard, User } = require('../../models');
const { normalizeEmail, accessCardOwner } = require('../../shared/identity');

// Who owns a card (docs/access.md sections 4 and 5): one live card per person; a guest's card is a draft until
// a plan is chosen or paid; a guest whose email already has an account signs in and claims the draft; deleting a
// card keeps the person's subscription, keychain and public link for their next card.

// The person's live card, if any. `transaction` and `lock` pass through.
const liveCardOf = (userId, options = {}) =>
    BusinessCard.findOne({ where: { user_id: userId }, order: [['id', 'DESC']], ...options });

const cardExists = (card) =>
    ApiError.withCode(
        httpStatus.CONFLICT,
        'You already have an Access card. Edit it, or delete it to make a new one.',
        'CARD_EXISTS',
        { card_id: card.id },
    );

const accountExists = () =>
    ApiError.withCode(httpStatus.CONFLICT, 'This email already has a Glamlink account. Sign in to continue.', 'ACCOUNT_EXISTS');

// The public link and QR code of the person's most recently deleted card: their next card takes them over, so
// printed QR codes and the NFC keychain keep working.
const previousLinkOf = async (userId, transaction) => {
    const old = await BusinessCard.findOne({
        where: { user_id: userId, deleted_at: { [Op.ne]: null }, business_card_link: { [Op.ne]: null } },
        order: [['deleted_at', 'DESC']],
        attributes: ['business_card_link', 'business_card_qr'],
        paranoid: false,
        transaction,
    });
    return old ? { business_card_link: old.business_card_link, business_card_qr: old.business_card_qr } : {};
};

// A card's plan fields from its owner: the subscription is the person's, and so is the keychain they bought
// (on any of their cards, deleted ones too).
const planFieldsFor = async (user, transaction) => {
    const keychain = Boolean(await BusinessCard.findOne({
        where: { user_id: user.id, nfc_status: 'paid' },
        attributes: ['id'],
        paranoid: false,
        transaction,
    }));
    const pro = user.subscription_status === 'ACTIVE';
    return {
        nfc_status: keychain ? 'paid' : 'not_purchased',
        plan_type: pro ? (keychain ? 'nfc_with_subscription' : 'subscription_only') : keychain ? 'nfc_only' : 'free',
    };
};

// Makes room for a person's new card. Without `replace`, a live card refuses with CARD_EXISTS; with it, the live
// card is deleted (kept in the database) and its link passes on. Returns the link fields for the new card.
const makeRoomFor = async (userId, { replace = false, transaction }) => {
    const current = await liveCardOf(userId, { transaction });
    if (!current) return previousLinkOf(userId, transaction);
    if (!replace) throw cardExists(current);
    const link = { business_card_link: current.business_card_link, business_card_qr: current.business_card_qr };
    await current.destroy({ transaction });
    return link;
};

// One card change at a time per person: locks their account row for the transaction.
const lockPerson = (userId, transaction) => User.findByPk(userId, { attributes: ['id'], lock: transaction.LOCK.UPDATE, transaction });

// A guest's card may go on only while its email has no account: the account's owner signs in and claims it.
const assertNoAccountFor = async (card) => {
    if (card.user_id || !card.email) return;
    const account = await User.findOne({ where: { email: normalizeEmail(card.email) }, attributes: ['id'] });
    if (account) throw accountExists();
};

/**
 * A signed-in person takes over the draft they made as a guest (they hold its card token). The card goes live as
 * theirs, with their plan and keychain; `replace` swaps out the card they already have.
 */
const claimCard = async ({ user, cardId, replace }) => {
    // Buying an Access card makes an app account a professional one.
    const { user: owner } = await accessCardOwner({ email: user.email });
    return sequelize.transaction(async (transaction) => {
        await lockPerson(owner.id, transaction);
        const card = await BusinessCard.findByPk(cardId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!card) throw new ApiError(httpStatus.NOT_FOUND, 'Business card not found.');
        if (card.user_id && String(card.user_id) === String(owner.id)) return card;
        if (card.user_id || card.status !== 'draft') {
            throw ApiError.withCode(httpStatus.CONFLICT, 'This card can no longer be claimed.', 'CARD_NOT_CLAIMABLE');
        }
        const link = await makeRoomFor(owner.id, { replace, transaction });
        const plan = await planFieldsFor(owner, transaction);
        await card.update({ user_id: owner.id, status: 'accepted', ...plan, ...link }, { transaction });
        return card;
    });
};

// The owner deletes their card. It stays in the database; their subscription goes on, and their next card takes
// over its link.
const deleteOwnCard = async ({ user, cardId }) => {
    const card = await BusinessCard.findOne({ where: { id: cardId, user_id: user.id } });
    if (!card) throw new ApiError(httpStatus.NOT_FOUND, 'Business card not found.');
    await card.destroy();
    return { deleted: true, subscription_continues: user.subscription_status === 'ACTIVE' };
};

module.exports = {
    liveCardOf,
    planFieldsFor,
    makeRoomFor,
    lockPerson,
    assertNoAccountFor,
    claimCard,
    deleteOwnCard,
};
