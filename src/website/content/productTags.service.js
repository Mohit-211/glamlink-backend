// Product tags (Mohit, Nov 4): one per product, shown top-left on its card and page, from a list admins keep. An
// editorial tag ("Featured in The Beauty Vault") is set by admins only, so owners can't claim a feature they didn't get;
// an open one ("New") by owners too (myProducts.service.js).
const { Op } = require('sequelize');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const sequelize = require('../../core/db/central.db');
const { isYes, wholeNumber } = require('../../core/utils/formValues');
const { ProductTag, Shop } = require('../../models');

const NAME_LENGTH = 40;
const ORDER = [['sort_order', 'ASC'], ['name', 'ASC'], ['id', 'ASC']];

const refuse = (field, message) => ApiError.withCode(httpStatus.BAD_REQUEST, message, 'INVALID_TAG', { field });
const exists = () => ApiError.withCode(httpStatus.CONFLICT, 'A tag of this name exists.', 'TAG_EXISTS', { field: 'name' });
const notFound = () => ApiError.withCode(httpStatus.NOT_FOUND, 'No such tag.', 'NOT_FOUND');
const adminOnly = () => ApiError.withCode(httpStatus.FORBIDDEN, 'Only Glamlink sets or changes this tag.', 'TAG_ADMIN_ONLY', { field: 'tag_id' });

const tagRow = (tag) => ({ id: tag.id, name: tag.name, is_editorial: Boolean(tag.is_editorial), sort_order: tag.sort_order });

// GET /discover/shop/tags: every tag, in the admins' order (then by name).
const listTags = async () => (await ProductTag.findAll({ order: ORDER })).map(tagRow);

const tagById = async (id) => {
    const tag = await ProductTag.findByPk(wholeNumber(id) ?? 0);
    if (!tag) throw notFound();
    return tag;
};

// A tag's name from the admin form: 1 to 40 characters, no other tag's (in any case: the column's collation).
const tagName = async (value, id = null) => {
    const name = String(value ?? '').trim();
    if (!name) throw refuse('name', 'name is required.');
    if ([...name].length > NAME_LENGTH) throw refuse('name', `name is at most ${NAME_LENGTH} characters.`);
    if (await ProductTag.findOne({ where: { name, ...(id && { id: { [Op.ne]: id } }) }, attributes: ['id'] })) throw exists();
    return name;
};

// Saves a tag; a name taken meanwhile is the same 409.
const saved = async (save) => {
    try {
        return tagRow(await save());
    } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') throw exists();
        throw err;
    }
};

// POST /discover/shop/tags { name, is_editorial }: a new tag, last in the order.
const createTag = async (body = {}) => {
    const name = await tagName(body.name);
    const last = await ProductTag.max('sort_order');
    return saved(() => ProductTag.create({ name, is_editorial: isYes(body.is_editorial), sort_order: (Number(last) || 0) + 1 }));
};

// PUT /discover/shop/tags/:id { name?, is_editorial? }.
const updateTag = async (id, body = {}) => {
    const tag = await tagById(id);
    if (body.name !== undefined) tag.name = await tagName(body.name, tag.id);
    if (body.is_editorial !== undefined) tag.is_editorial = isYes(body.is_editorial);
    return saved(() => tag.save());
};

// PUT /discover/shop/tags/order { ids }: the tags in this order; any left out keep theirs, after these. Answers the list.
const orderTags = async (body = {}) => {
    let ids = body.ids;
    if (typeof ids === 'string') {
        try {
            ids = JSON.parse(ids);
        } catch {
            ids = null;
        }
    }
    if (!Array.isArray(ids)) throw refuse('ids', 'ids is the list of tag ids, in their new order.');
    const tags = await ProductTag.findAll({ attributes: ['id'], order: ORDER });
    const known = new Set(tags.map((tag) => tag.id));
    const wanted = ids.map((id) => wholeNumber(id));
    const unknown = wanted.findIndex((id) => !known.has(id));
    if (unknown !== -1) throw refuse('ids', `${ids[unknown]} is not a tag.`);
    const order = [...new Set([...wanted, ...tags.map((tag) => tag.id)])];
    await sequelize.transaction(async (transaction) => {
        for (const [i, id] of order.entries()) await ProductTag.update({ sort_order: i + 1 }, { where: { id }, transaction });
    });
    return listTags();
};

// DELETE /discover/shop/tags/:id: the tag goes, and the products that carried it lose it.
const deleteTag = async (id) => {
    const tag = await tagById(id);
    return sequelize.transaction(async (transaction) => {
        const [untagged] = await Shop.update({ tag_id: null }, { where: { tag_id: tag.id }, transaction });
        await tag.destroy({ transaction });
        return { id: tag.id, products_untagged: untagged };
    });
};

// { id, name, is_editorial } of each of these tags, by id: what a product row shows of its tag.
const tagsByIds = async (ids) => {
    const unique = [...new Set(ids.filter(Boolean).map(Number))];
    if (!unique.length) return new Map();
    const tags = await ProductTag.findAll({ where: { id: unique }, attributes: ['id', 'name', 'is_editorial'] });
    return new Map(tags.map((tag) => [tag.id, { id: tag.id, name: tag.name, is_editorial: Boolean(tag.is_editorial) }]));
};

// A product's tag_id from a form: the tag, null to clear it ("" or null), undefined when not sent. Not a tag: a 400.
const tagOf = async (value) => {
    if (value === undefined) return undefined;
    if (value === null || String(value).trim() === '') return null;
    const id = wholeNumber(value);
    const tag = id && (await ProductTag.findByPk(id));
    if (!tag) throw ApiError.withCode(httpStatus.BAD_REQUEST, 'tag_id is a tag from the list.', 'INVALID_PRODUCT', { field: 'tag_id' });
    return tag;
};

// An admin's tag_id: any tag, or null; undefined when not sent.
const adminTagId = async (value) => {
    const tag = await tagOf(value);
    return tag === undefined ? undefined : tag?.id ?? null;
};

// An owner's tag_id: an open tag, or "" to clear it; undefined when not sent. An editorial tag is the admins' to set,
// and while the product carries one, to change or clear (403 TAG_ADMIN_ONLY); sending the same id keeps it.
const ownerTagId = async (value, currentId = null) => {
    const tag = await tagOf(value);
    if (tag === undefined) return undefined;
    const current = currentId ? await ProductTag.findByPk(currentId) : null;
    const id = tag?.id ?? null;
    if (current?.is_editorial && id !== current.id) throw adminOnly();
    if (tag?.is_editorial && id !== current?.id) throw adminOnly();
    return id;
};

module.exports = { listTags, createTag, updateTag, orderTags, deleteTag, tagsByIds, adminTagId, ownerTagId };
