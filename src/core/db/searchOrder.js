// Search results: rows whose column equals the search text first, then those starting with it; the caller's order
// follows. `column` is SQL as the query names it (`Journal`.`title`).
const { literal } = require('sequelize');
const sequelize = require('./central.db');
const { startingWith } = require('../utils/like');

const matchFirst = (column, text) => [
    [literal(`(${column} = ${sequelize.escape(String(text))})`), 'DESC'],
    [literal(`(${column} LIKE ${sequelize.escape(startingWith(text))})`), 'DESC'],
];

module.exports = { matchFirst };
