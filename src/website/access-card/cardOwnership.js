const { Op } = require('sequelize');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const sequelize = require('../../core/db/central.db');
const { refreshWebsite } = require('../../integrations/websiteRefresh');
const { BusinessCard, User, Shop } = require('../../models');
const { normalizeEmail, accessCardOwner, setProfessionalType, isAppAccount } = require('../../shared/identity');
const { planFieldsFor, seatOf, isPro } = require('./seats');

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

// The account a guest must sign in to before their card goes on: one the email already has on the website. An app
// account does not count (Nov 1): the purchase makes it a professional account, as for a new email.
const websiteAccountFor = async (email) => {
    if (!email) return null;
    const account = await User.findOne({ where: { email: normalizeEmail(email) }, attributes: ['id', 'account_type'] });
    return account && !isAppAccount(account) ? account : null;
};

// A guest's card may go on only while its email has no website account: the account's owner signs in and claims it.
const assertNoAccountFor = async (card) => {
    if (card.user_id || !card.email) return;
    if (await websiteAccountFor(card.email)) throw accountExists();
};

/**
 * The type (individual or brand) of a card an existing professional takes, by signing in to create it or by claiming
 * it (one-form.md 5.1): the account adopts the card's type when nothing depends on the account's yet (no other live
 * card, `hadCard`, and no products); otherwise the card takes the account's. Returns the card's type.
 */
const settleCardType = async (userId, cardType, { hadCard, transaction }) => {
    const owner = await User.findByPk(userId, { attributes: ['id', 'professional_type', 'role_id'], transaction });
    const wanted = cardType === 'brand' ? 'brand' : 'individual';
    const current = owner.professional_type || 'individual';
    if (current === wanted) return wanted;
    if (hadCard || await Shop.findOne({ where: { owner_id: userId }, attributes: ['id'], transaction })) return current;
    await setProfessionalType(owner, wanted, { transaction });
    return wanted;
};

/**
 * A signed-in person takes over the draft they made as a guest (they hold its card token). The card goes live as
 * theirs, with their plan and keychain; `replace` swaps out the card they already have. An app account becomes a
 * professional one of the card's type; an existing professional's type is settled with the card's (settleCardType).
 */
const claimCard = async ({ user, cardId, replace }) => {
    const card = await sequelize.transaction(async (transaction) => {
        const draft = await BusinessCard.findByPk(cardId, { attributes: ['id', 'professional_type'], transaction });
        if (!draft) throw new ApiError(httpStatus.NOT_FOUND, 'Business card not found.');
        const { user: owner, converted } = await accessCardOwner({ email: user.email, professionalType: draft.professional_type, transaction });
        await lockPerson(owner.id, transaction);
        const claimed = await BusinessCard.findByPk(cardId, { transaction, lock: transaction.LOCK.UPDATE });
        if (claimed.user_id && String(claimed.user_id) === String(owner.id)) return claimed;
        if (claimed.user_id || claimed.status !== 'draft') {
            throw ApiError.withCode(httpStatus.CONFLICT, 'This card can no longer be claimed.', 'CARD_NOT_CLAIMABLE');
        }
        const hadCard = Boolean(await liveCardOf(owner.id, { transaction }));
        const link = await makeRoomFor(owner.id, { replace, transaction });
        const type = converted ? claimed.professional_type : await settleCardType(owner.id, claimed.professional_type, { hadCard, transaction });
        const plan = await planFieldsFor(owner, transaction);
        await claimed.update({ user_id: owner.id, status: 'accepted', professional_type: type, ...plan, ...link }, { transaction });
        return claimed;
    });
    refreshWebsite(['cards', 'profiles']);
    return card;
};

// The owner deletes their card. It stays in the database; their subscription goes on, and their next card takes
// over its link.
const deleteOwnCard = async ({ user, cardId }) => {
    const card = await BusinessCard.findOne({ where: { id: cardId, user_id: user.id } });
    if (!card) throw new ApiError(httpStatus.NOT_FOUND, 'Business card not found.');
    await card.destroy();
    refreshWebsite(['cards', 'profiles']);
    return { deleted: true, subscription_continues: isPro(await seatOf(user.id)) };
};

module.exports = {
    liveCardOf,
    makeRoomFor,
    lockPerson,
    websiteAccountFor,
    assertNoAccountFor,
    settleCardType,
    claimCard,
    deleteOwnCard,
};
