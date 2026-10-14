// Password rules: 8-100 characters, at least 2 digits, no whitespace, not a known weak password.
const BLOCKED = new Set(['Passw0rd', 'Password123']);

const validatePassword = (password) =>
    typeof password === 'string' &&
    password.length >= 8 &&
    password.length <= 100 &&
    (password.match(/\d/g) || []).length >= 2 &&
    !/\s/.test(password) &&
    !BLOCKED.has(password);

module.exports = validatePassword;
