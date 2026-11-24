// A topic's items (Mohit, Nov 24): the articles, videos (The Beauty Vault's episodes among them), professionals, brands
// and products on a topic page, attached by an admin or by the AI (topicAi.service.js). They live in the topic's link
// tables, which the article's and the video's own editors also write (their lists of topics); admins list, add, remove
// and order them here. What the AI attached or suggested carries its score and reason (journal_topic_ai_items); an item
// an admin takes off is remembered as rejected, so no later AI run puts it back.
const sequelize = require('../../core/db/central.db');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const { wholeNumber } = require('../../core/utils/formValues');
const { JournalTopic, JournalTopicAiItem, Journal, Shop } = require('../../models');
const { pageCards } = require('../profiles');
const { videoCards } = require('../watch');

const TYPES = ['article', 'video', 'professional', 'brand', 'product'];

// Where each type's links live. `ordered`: the topic orders them (the admin's order, AI picks after); articles and
// videos show newest first, as their links' order is each article's or video's own order of its topics. `account`: the
// linked accounts' professional_type (professionals and brands share one table). `soft`: links deleted softly before.
const LINKS = {
    article: { table: 'journal_topic_mappings', column: 'journal_id', soft: true, ordered: false },
    video: { table: 'journal_topic_video_mappings', column: 'video_id', soft: false, ordered: false },
    professional: { table: 'journal_topic_professional_mappings', column: 'user_id', soft: true, ordered: true, account: 'individual' },
    brand: { table: 'journal_topic_professional_mappings', column: 'user_id', soft: true, ordered: true, account: 'brand' },
    product: { table: 'journal_topic_product_mappings', column: 'shop_id', soft: true, ordered: true },
};

// A link: an earlier one deleted softly comes back (the unique keys count deleted rows: A-CNT-1).
const INSERT = {
    article: `INSERT INTO journal_topic_mappings (journal_id, topic_id, sort_order) VALUES (:id, :topicId, :order)
        ON DUPLICATE KEY UPDATE deleted_at = NULL, sort_order = :order`,
    video: `INSERT INTO journal_topic_video_mappings (topic_id, video_id, sort_order) VALUES (:topicId, :id, :order)
        ON DUPLICATE KEY UPDATE sort_order = :order`,
    professional: `INSERT INTO journal_topic_professional_mappings (topic_id, user_id, sort_order, is_active) VALUES (:topicId, :id, :order, 1)
        ON DUPLICATE KEY UPDATE deleted_at = NULL, is_active = 1, sort_order = :order`,
    product: 'INSERT INTO journal_topic_product_mappings (topic_id, shop_id, sort_order, is_active) VALUES (:topicId, :id, :order, 1)',
};
INSERT.brand = INSERT.professional;

// The items that may go on a topic: articles and products not deleted (drafts too: the public sees them once published),
// any video, and active professional or brand accounts.
const ACCOUNT_OF_TYPE = `account_type = 'professional' AND is_active = 1 AND deleted_at IS NULL AND merged_into_user_id IS NULL
    AND COALESCE(professional_type, 'individual') = :account`;
const ELIGIBLE = {
    article: 'SELECT id FROM journals WHERE id IN (:ids) AND is_active = 1 AND deleted_at IS NULL',
    video: 'SELECT id FROM videos WHERE id IN (:ids)',
    professional: `SELECT id FROM users WHERE id IN (:ids) AND ${ACCOUNT_OF_TYPE}`,
    brand: `SELECT id FROM users WHERE id IN (:ids) AND ${ACCOUNT_OF_TYPE}`,
    product: 'SELECT id FROM shops WHERE id IN (:ids) AND is_active = 1 AND deleted_at IS NULL',
};

const refuse = (field, message) => ApiError.withCode(httpStatus.BAD_REQUEST, message, 'INVALID_TOPIC_ITEM', { field });
const notFound = (message) => ApiError.withCode(httpStatus.NOT_FOUND, message, 'NOT_FOUND');

// An active topic by its id, or 404.
const topicOrNotFound = async (id) => {
    const topic = /^\d+$/.test(String(id)) && (await JournalTopic.findOne({ where: { id, is_active: true }, attributes: ['id', 'name', 'slug', 'description'] }));
    if (!topic) throw notFound('Topic not found.');
    return topic;
};

const typeOf = (value) => {
    if (!TYPES.includes(value)) throw refuse('type', `type is one of ${TYPES.join(', ')}.`);
    return value;
};

// The ids of a type on the topic, in the links' order.
const attachedIds = async (topicId, type, { transaction } = {}) => {
    const link = LINKS[type];
    const [rows] = await sequelize.query(
        `SELECT m.${link.column} AS id FROM ${link.table} m
         ${link.account ? "JOIN users u ON u.id = m.user_id AND COALESCE(u.professional_type, 'individual') = :account" : ''}
         WHERE m.topic_id = :topicId ${link.soft ? 'AND m.deleted_at IS NULL' : ''}
         ORDER BY m.sort_order ASC, m.id ASC`,
        { replacements: { topicId, account: link.account ?? null }, transaction },
    );
    return [...new Set(rows.map((row) => Number(row.id)))];
};

// Which of these ids may go on a topic as this type.
const eligibleIds = async (type, ids, { transaction } = {}) => {
    if (!ids.length) return new Set();
    const [rows] = await sequelize.query(ELIGIBLE[type], { replacements: { ids, account: LINKS[type].account ?? null }, transaction });
    return new Set(rows.map((row) => Number(row.id)));
};

// Locks the topic's row until the transaction ends: changes to one topic's items (an admin's, an AI run's) wait for each
// other, so an item is never linked twice (the products' link table has no unique key) and one AI run starts at a time.
const lockTopic = (topicId, transaction) =>
    sequelize.query('SELECT id FROM journal_topics WHERE id = :topicId FOR UPDATE', { replacements: { topicId }, transaction });

// Links these items to the topic after the ones it has (each once; linked ones stay where they are). Answers the ids
// newly linked. In a transaction, the topic is locked first (lockTopic).
const attach = async (topicId, type, ids, { transaction } = {}) => {
    const link = LINKS[type];
    if (transaction) await lockTopic(topicId, transaction);
    const have = new Set(await attachedIds(topicId, type, { transaction }));
    const fresh = [...new Set(ids)].filter((id) => !have.has(id));
    for (const id of fresh) {
        const [[{ next }]] = await sequelize.query(
            `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM ${link.table} WHERE ${link.ordered ? 'topic_id = :topicId' : `${link.column} = :id`}`,
            { replacements: { topicId, id }, transaction },
        );
        await sequelize.query(INSERT[type], { replacements: { topicId, id, order: Number(next) }, transaction });
    }
    return fresh;
};

// Takes an item off the topic (its links deleted for good).
const detach = (topicId, type, id, { transaction } = {}) =>
    sequelize.query(`DELETE FROM ${LINKS[type].table} WHERE topic_id = :topicId AND ${LINKS[type].column} = :id`, { replacements: { topicId, id }, transaction });

// What the AI knows of an item for a topic: its status (suggested, added, rejected), score and reason. Made or changed.
const setAiStatus = async (topicId, type, id, status, { score, reason, runId, transaction } = {}) => {
    const where = { topic_id: topicId, item_type: type, item_id: id };
    const row = await JournalTopicAiItem.findOne({ where, transaction });
    const values = { status, ...(score !== undefined && { score }), ...(reason !== undefined && { reason }), ...(runId !== undefined && { run_id: runId }) };
    if (row) await row.update(values, { transaction });
    else await JournalTopicAiItem.create({ ...where, score: 0, reason: null, run_id: null, ...values }, { transaction });
};

// After an admin puts items on the topic: a suggestion taken counts as the AI's (added), a past rejection is forgotten.
const adminAdded = async (topicId, type, ids, { transaction } = {}) => {
    if (!ids.length) return;
    const rows = await JournalTopicAiItem.findAll({ where: { topic_id: topicId, item_type: type, item_id: ids }, transaction });
    for (const row of rows) {
        if (row.status === 'suggested') await row.update({ status: 'added' }, { transaction });
        else if (row.status === 'rejected') await row.destroy({ transaction });
    }
};

// Replaces a type's items with these, in this order (the admin panel's pickers: PUT /journal/topic/:id/professionals and
// /brands). Items taken off are remembered as rejected. Refuses ids that may not go on a topic, as the pickers did.
const setItems = async (topicId, type, ids, { label = `${type} IDs` } = {}) => {
    const unique = [...new Set(ids)];
    const eligible = await eligibleIds(type, unique);
    if (unique.some((id) => !eligible.has(id))) throw new ApiError(httpStatus.BAD_REQUEST, `One or more ${label} are invalid`);
    await sequelize.transaction(async (transaction) => {
        await lockTopic(topicId, transaction);
        const before = await attachedIds(topicId, type, { transaction });
        for (const gone of before.filter((id) => !unique.includes(id))) {
            await detach(topicId, type, gone, { transaction });
            await setAiStatus(topicId, type, gone, 'rejected', { transaction });
        }
        await attach(topicId, type, unique, { transaction });
        await adminAdded(topicId, type, unique, { transaction });
        if (LINKS[type].ordered) {
            for (const [index, id] of unique.entries()) {
                await sequelize.query(`UPDATE ${LINKS[type].table} SET sort_order = :order WHERE topic_id = :topicId AND ${LINKS[type].column} = :id`,
                    { replacements: { topicId, id, order: index + 1 }, transaction });
            }
        }
    });
};

// --- What admins see

const dateOf = (item) => new Date(item.date ?? 0).getTime();
const newestFirst = (a, b) => dateOf(b) - dateOf(a) || b.id - a.id;

// Each type's items as admins see them, by id: { id, title, slug, image, status, ... } (status: published or draft; a
// page's visible or hidden).
const DESCRIBE = {
    article: async (ids) => {
        const rows = await Journal.findAll({ where: { id: ids }, attributes: ['id', 'title', 'slug', 'cover_image', 'status', 'publish_date', 'created_at'] });
        return rows.map((j) => ({ id: Number(j.id), title: j.title, slug: j.slug, image: j.cover_image, status: j.status, date: j.publish_date || j.created_at }));
    },
    video: async (ids) => (await videoCards(ids)).map((v) => ({
        id: Number(v.id), title: v.title, slug: v.slug, image: v.thumbnail, status: v.status, date: v.published_at, series: v.series,
    })),
    professional: async (ids) => [...(await pageCards(ids, { hidden: true })).values()].map((p) => ({
        id: p.id, title: p.name, slug: p.slug, image: p.image, status: p.visible ? 'visible' : 'hidden', tagline: p.tagline, city: p.city, state: p.state,
        category_label: p.category_label,
    })),
    product: async (ids) => {
        const rows = await Shop.findAll({ where: { id: ids }, attributes: ['id', 'title', 'slug', 'cover_image', 'status', 'brand', 'price', 'created_at'] });
        return rows.map((s) => ({
            id: Number(s.id), title: s.title, slug: s.slug, image: s.cover_image, status: s.status, brand: s.brand, price: s.price === null ? null : Number(s.price), date: s.created_at,
        }));
    },
};
DESCRIBE.brand = DESCRIBE.professional;

const aiPart = (row) => (row ? { status: row.status, score: Number(row.score), reason: row.reason, run_id: row.run_id === null ? null : Number(row.run_id) } : null);

/**
 * GET /journal/topic/:id/items: { topic, items, suggestions }, both by type (article, video, professional, brand,
 * product). `items`: what is on the topic (articles and videos newest first, the rest in the topic's order), each with
 * `source` (ai or admin) and `ai` (its score and reason, when the AI picked it). `suggestions`: what a suggest run picked
 * that is not on the topic yet.
 */
const listItems = async (topicId) => {
    const topic = await topicOrNotFound(topicId);
    const ai = await JournalTopicAiItem.findAll({ where: { topic_id: topic.id } });
    const aiOf = new Map(ai.map((row) => [`${row.item_type}:${Number(row.item_id)}`, row]));
    const items = {};
    const suggestions = {};
    for (const type of TYPES) {
        const attached = await attachedIds(topic.id, type);
        const suggested = ai.filter((row) => row.item_type === type && row.status === 'suggested' && !attached.includes(Number(row.item_id))).map((row) => Number(row.item_id));
        const described = new Map((await DESCRIBE[type]([...attached, ...suggested])).map((item) => [item.id, item]));
        const view = (id, source) => ({ type, ...described.get(id), source, ai: aiPart(aiOf.get(`${type}:${id}`)) });
        const on = attached.filter((id) => described.has(id)).map((id) => view(id, aiOf.get(`${type}:${id}`)?.status === 'added' ? 'ai' : 'admin'));
        items[type] = LINKS[type].ordered ? on : on.toSorted(newestFirst);
        suggestions[type] = suggested.filter((id) => described.has(id)).map((id) => view(id, 'ai')).toSorted((a, b) => b.ai.score - a.ai.score);
    }
    return { topic: { id: Number(topic.id), name: topic.name, slug: topic.slug }, items, suggestions };
};

// The items of a request: { type, id }, or { items: [{ type, id }] } (at most 100).
const itemsOf = (body = {}) => {
    const list = Array.isArray(body.items) ? body.items : [{ type: body.type, id: body.id }];
    if (!list.length || list.length > 100) throw refuse('items', 'Send 1 to 100 items.');
    return list.map((item) => {
        const type = typeOf(item?.type);
        const id = wholeNumber(item?.id);
        if (!(id > 0)) throw refuse('id', 'Each item needs its id.');
        return { type, id };
    });
};

// POST /journal/topic/:id/items: puts items on the topic (after the ones it has; one already on stays where it is). A
// suggestion taken this way counts as the AI's pick. Answers the list.
const addItems = async (topicId, body) => {
    const topic = await topicOrNotFound(topicId);
    const wanted = itemsOf(body);
    const byType = new Map();
    for (const { type, id } of wanted) byType.set(type, [...(byType.get(type) ?? []), id]);
    for (const [type, ids] of byType) {
        const eligible = await eligibleIds(type, ids);
        const bad = ids.find((id) => !eligible.has(id));
        if (bad) throw refuse('id', `There is no ${type} ${bad} that can go on a topic.`);
    }
    await sequelize.transaction(async (transaction) => {
        for (const [type, ids] of byType) {
            await attach(topic.id, type, ids, { transaction });
            await adminAdded(topic.id, type, ids, { transaction });
        }
    });
    return listItems(topic.id);
};

// DELETE /journal/topic/:id/items/:type/:itemId: takes an item off the topic, or dismisses a suggestion. Either way the
// AI won't bring it back. Answers the list.
const removeItem = async (topicId, type, itemId) => {
    const topic = await topicOrNotFound(topicId);
    typeOf(type);
    const id = wholeNumber(itemId);
    const attached = id > 0 && (await attachedIds(topic.id, type)).includes(id);
    const suggested = id > 0 && (await JournalTopicAiItem.findOne({ where: { topic_id: topic.id, item_type: type, item_id: id, status: 'suggested' } }));
    if (!attached && !suggested) throw notFound('This item is not on the topic.');
    await sequelize.transaction(async (transaction) => {
        if (attached) await detach(topic.id, type, id, { transaction });
        await setAiStatus(topic.id, type, id, 'rejected', { transaction });
    });
    return listItems(topic.id);
};

// PUT /journal/topic/:id/items/:type/order { ids }: the topic's order of its professionals, brands or products: these
// first, in this order, then the rest as they were. Answers the list.
const orderItems = async (topicId, type, body = {}) => {
    const topic = await topicOrNotFound(topicId);
    typeOf(type);
    if (!LINKS[type].ordered) throw refuse('type', 'Articles and videos show newest first: their order is not set here.');
    const raw = typeof body.ids === 'string' ? body.ids.split(',') : body.ids;
    if (!Array.isArray(raw) || !raw.length) throw refuse('ids', 'ids is the list of the items in their new order.');
    const ids = [...new Set(raw.map(wholeNumber))];
    const attached = await attachedIds(topic.id, type);
    const stranger = ids.find((id) => !attached.includes(id));
    if (stranger !== undefined) throw refuse('ids', `${stranger ?? 'An id'} is not on this topic.`);
    const order = [...ids, ...attached.filter((id) => !ids.includes(id))];
    await sequelize.transaction(async (transaction) => {
        for (const [index, id] of order.entries()) {
            await sequelize.query(`UPDATE ${LINKS[type].table} SET sort_order = :order WHERE topic_id = :topicId AND ${LINKS[type].column} = :id`,
                { replacements: { topicId: topic.id, id, order: index + 1 }, transaction });
        }
    });
    return listItems(topic.id);
};

module.exports = {
    TYPES, LINKS, topicOrNotFound, lockTopic, attachedIds, eligibleIds, attach, setAiStatus, setItems, listItems, addItems, removeItem, orderItems,
};
