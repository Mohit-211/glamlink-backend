// Who an article features (journal_mentions): the @handles in its text, kept in step on every save, and the accounts
// editors add. A handle is matched to an account when read: a page's slug or a card's handle (deleted cards too: a
// handle stays its owner's), professional accounts only. So an article finds a professional who joins after it.
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const sequelize = require('../../core/db/central.db');
const { isYes, wholeNumber } = require('../../core/utils/formValues');
const { JournalMention, Journal, User } = require('../../models');
const { pageLinks } = require('../profiles');
const { handlesIn } = require('./mentionText');

// handle -> account id, for the handles that belong to a professional account (a page's slug first).
const accountsForHandles = async (handles) => {
    if (!handles.length) return new Map();
    const [rows] = await sequelize.query(
        `SELECT LOWER(pp.slug) COLLATE utf8mb4_unicode_ci AS handle, pp.user_id, 1 AS page FROM profile_pages pp JOIN users u ON u.id = pp.user_id
         WHERE pp.slug IN (:handles) AND u.account_type = 'professional' AND u.is_active = 1 AND u.deleted_at IS NULL
         UNION
         SELECT LOWER(c.slug) COLLATE utf8mb4_unicode_ci, c.user_id, 0 FROM business_cards c JOIN users u ON u.id = c.user_id
         WHERE c.slug IN (:handles) AND u.account_type = 'professional' AND u.is_active = 1 AND u.deleted_at IS NULL
         ORDER BY page DESC`,
        { replacements: { handles } },
    );
    const accounts = new Map();
    for (const row of rows) if (!accounts.has(row.handle)) accounts.set(row.handle, Number(row.user_id));
    return accounts;
};

// Keeps an article's text mentions in step with its HTML (on create and edit): new handles are added, handles gone
// from the text go, and the ones that stay keep an editor's `excluded`. Answers the handles that match no one, for
// the editor to check.
const indexMentions = async (journalId, html) => {
    const handles = handlesIn(html);
    const existing = await JournalMention.findAll({ where: { journal_id: journalId, source: 'text' } });
    const gone = existing.filter((m) => !handles.includes(m.handle)).map((m) => m.id);
    if (gone.length) await JournalMention.destroy({ where: { id: gone } });
    const kept = new Set(existing.map((m) => m.handle));
    const fresh = handles.filter((handle) => !kept.has(handle));
    if (fresh.length) await JournalMention.bulkCreate(fresh.map((handle) => ({ journal_id: journalId, source: 'text', handle })));
    const accounts = await accountsForHandles(handles);
    return handles.filter((handle) => !accounts.has(handle));
};

// Each mention with its account id (undefined when its handle matches no one).
const resolve = async (rows) => {
    const accounts = await accountsForHandles(rows.filter((m) => m.source === 'text').map((m) => m.handle));
    return rows.map((m) => ({ mention: m, userId: m.source === 'text' ? accounts.get(m.handle) : Number(m.user_id) }));
};

// The people an article features, for its page: [{ handle, slug, name, type }] of those with a visible page, once
// each per handle (handle null for an account an editor added).
const mentionsOf = async (journalId) => {
    const rows = await JournalMention.findAll({ where: { journal_id: journalId, excluded: false }, order: [['id', 'ASC']] });
    const resolved = (await resolve(rows)).filter((r) => r.userId);
    const links = await pageLinks(resolved.map((r) => r.userId));
    const byText = new Set(resolved.filter((r) => r.mention.source === 'text').map((r) => r.userId));
    const seen = new Set();
    const people = [];
    for (const { mention, userId } of resolved) {
        const link = links.get(userId);
        const key = `${mention.handle}:${userId}`;
        if (!link || seen.has(key) || (mention.source === 'editor' && byText.has(userId))) continue;
        seen.add(key);
        people.push({ handle: mention.source === 'text' ? mention.handle : null, slug: link.slug, name: link.name, type: link.type });
    }
    return people;
};

const articleOrNotFound = async (journalId) => {
    const article = await Journal.findByPk(journalId, { attributes: ['id'] });
    if (!article) throw ApiError.withCode(httpStatus.NOT_FOUND, 'Article not found.', 'NOT_FOUND');
    return article;
};

// An article's mentions as editors see them: each with its account ({ id, slug, name, type, visible }, null when its
// handle matches no one), and the handles that match no one.
const adminMentions = async (journalId) => {
    await articleOrNotFound(journalId);
    const rows = await JournalMention.findAll({ where: { journal_id: journalId }, order: [['id', 'ASC']] });
    const resolved = await resolve(rows);
    const links = await pageLinks(resolved.map((r) => r.userId), { hidden: true });
    return {
        mentions: resolved.map(({ mention, userId }) => ({
            id: mention.id,
            source: mention.source,
            handle: mention.handle,
            excluded: mention.excluded,
            account: (userId && links.get(userId)) || null,
        })),
        unmatched: resolved.filter((r) => r.mention.source === 'text' && !r.userId).map((r) => r.mention.handle),
    };
};

const refuse = (field, message) => ApiError.withCode(httpStatus.BAD_REQUEST, message, 'INVALID_MENTION', { field });

// An editor features an account the article never @mentions.
const addMention = async (journalId, body) => {
    await articleOrNotFound(journalId);
    const id = wholeNumber(body.user_id);
    const account = id && (await User.findOne({ where: { id, account_type: 'professional', is_active: true }, attributes: ['id'] }));
    if (!account) throw refuse('user_id', 'user_id must be a professional or brand account.');
    const existing = await JournalMention.findOne({ where: { journal_id: journalId, source: 'editor', user_id: account.id } });
    if (!existing) await JournalMention.create({ journal_id: journalId, source: 'editor', user_id: account.id });
    return adminMentions(journalId);
};

const mentionOrNotFound = async (journalId, mentionId) => {
    const mention = await JournalMention.findOne({ where: { id: mentionId, journal_id: journalId } });
    if (!mention) throw ApiError.withCode(httpStatus.NOT_FOUND, 'Mention not found.', 'NOT_FOUND');
    return mention;
};

// Sets a text mention aside (`excluded: true`) or back.
const updateMention = async (journalId, mentionId, body) => {
    const mention = await mentionOrNotFound(journalId, mentionId);
    if (body.excluded === undefined) throw refuse('excluded', 'Send excluded: true or false.');
    if (mention.source !== 'text') throw refuse('excluded', 'Only a mention from the text is set aside; remove an added one.');
    await mention.update({ excluded: isYes(body.excluded) });
    return adminMentions(journalId);
};

// Removes an editor's mention; a mention from the text is set aside instead (it stays in the text).
const removeMention = async (journalId, mentionId) => {
    const mention = await mentionOrNotFound(journalId, mentionId);
    if (mention.source === 'editor') await mention.destroy();
    else await mention.update({ excluded: true });
    return adminMentions(journalId);
};

// The ids of the articles that feature an account: one of its handles (its cards' and its page's) in their text, not
// set aside, or added by an editor.
const articleIdsFeaturing = async (userId) => {
    const [handleRows] = await sequelize.query(
        `SELECT LOWER(slug) COLLATE utf8mb4_unicode_ci AS handle FROM business_cards WHERE user_id = :id AND slug IS NOT NULL
         UNION SELECT LOWER(slug) COLLATE utf8mb4_unicode_ci FROM profile_pages WHERE user_id = :id AND slug IS NOT NULL`,
        { replacements: { id: userId } },
    );
    const handles = handleRows.map((row) => row.handle);
    const [rows] = await sequelize.query(
        `SELECT DISTINCT journal_id FROM journal_mentions
         WHERE (source = 'editor' AND user_id = :id) ${handles.length ? "OR (source = 'text' AND excluded = 0 AND handle IN (:handles))" : ''}`,
        { replacements: { id: userId, handles } },
    );
    return rows.map((row) => Number(row.journal_id));
};

module.exports = { indexMentions, mentionsOf, adminMentions, addMention, updateMention, removeMention, articleIdsFeaturing, accountsForHandles };
