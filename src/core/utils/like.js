// A LIKE pattern matching `text` anywhere in a value, with %, _ and \ in the text taken literally (MariaDB's
// escape character is the backslash).
const escapeLike = (text) => String(text).replace(/[\\%_]/g, '\\$&');
const containing = (text) => `%${escapeLike(text)}%`;
const startingWith = (text) => `${escapeLike(text)}%`;

module.exports = { containing, startingWith };
