// The order of a page's items (its media, its education): the owner's, set whole with PUT .../order. New items go first,
// so what an owner adds shows on the page at once (the page shows the first few).
const sequelize = require('../../core/db/central.db');
const { wholeNumber } = require('../../core/utils/formValues');
const { refuse, jsonList } = require('./pageFields');

const ORDER = [['sort_order', 'ASC'], ['id', 'ASC']];

const numberOrNull = (value) => (value === null || value === undefined || Number.isNaN(Number(value)) ? null : Number(value));

// The places of `count` items added before the page's first one, in the order they were sent.
const firstPlaces = async (Model, userId, count) => {
    const first = numberOrNull(await Model.min('sort_order', { where: { user_id: userId } }));
    const start = first === null ? 1 : first - count;
    return Array.from({ length: count }, (_, i) => start + i);
};

// The place after the page's last item.
const nextPlace = async (Model, userId) => (numberOrNull(await Model.max('sort_order', { where: { user_id: userId } })) ?? 0) + 1;

// PUT .../order { ids }: every item of the page once (hidden items and drafts too), in the new order; a list, or the
// list as a JSON string. Answers { ok: true }.
const saveOrder = async (Model, userId, value) => {
    const ids = (jsonList(value, 'ids') || []).map(wholeNumber);
    const all = (await Model.findAll({ where: { user_id: userId }, attributes: ['id'] })).map((row) => Number(row.id));
    const listed = new Set(ids);
    if (ids.includes(null) || listed.size !== ids.length || ids.length !== all.length || !all.every((id) => listed.has(id))) {
        throw refuse('ids', 'ids lists every item once, in the new order.');
    }
    await sequelize.transaction(async (transaction) => {
        for (const [i, id] of ids.entries()) await Model.update({ sort_order: i + 1 }, { where: { id, user_id: userId }, transaction });
    });
    return { ok: true };
};

module.exports = { ORDER, firstPlaces, nextPlace, saveOrder };
