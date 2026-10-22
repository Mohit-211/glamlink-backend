// Values from forms and query strings, which arrive as strings.

// "true" and "1" (or true and 1) are yes; anything else is no.
const isYes = (value) => value === true || value === 1 || value === 'true' || value === '1';

// A whole number from "3" or 3; null for anything else, the empty string included.
const wholeNumber = (value) => {
    if (value === '' || value === null || value === undefined || typeof value === 'boolean') return null;
    const n = Number(value);
    return Number.isInteger(n) ? n : null;
};

module.exports = { isYes, wholeNumber };
