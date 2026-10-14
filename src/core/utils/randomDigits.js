const crypto = require('crypto');

// A numeric code of `length` digits (leading zeros allowed), from a cryptographically secure source.
const randomDigits = (length) => Array.from({ length }, () => crypto.randomInt(10)).join('');

module.exports = randomDigits;
