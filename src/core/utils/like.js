// A LIKE pattern matching `text` anywhere in a value, with %, _ and \ in the text taken literally (MariaDB's
// escape character is the backslash).
const containing = (text) => `%${String(text).replace(/[\\%_]/g, '\\$&')}%`;

module.exports = { containing };
