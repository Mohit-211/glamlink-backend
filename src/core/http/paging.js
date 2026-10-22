// Paged lists answer { count, rows } for ?page=1&limit=12, count being every matching row. A missing or bad value
// takes the default, and the limit is capped, so no request can ask for everything at once.
const MAX_LIMIT = 50;

const positive = (value) => {
    const n = Number.parseInt(value, 10);
    return Number.isInteger(n) && n > 0 ? n : null;
};

const paging = (query = {}, { defaultLimit = 12, maxLimit = MAX_LIMIT } = {}) => {
    const limit = Math.min(positive(query.limit) ?? defaultLimit, maxLimit);
    const page = positive(query.page) ?? 1;
    return { page, limit, offset: (page - 1) * limit };
};

// Ids from "12" or "12,15" (or ?id=12&id=15); anything that is not a positive whole number is dropped.
const idList = (value) =>
    [].concat(value ?? []).flatMap((v) => String(v).split(',')).map((v) => positive(v.trim())).filter(Boolean);

module.exports = { paging, idList, MAX_LIMIT };
