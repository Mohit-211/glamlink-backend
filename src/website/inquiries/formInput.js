// Fields of the website's public forms: trimmed and checked; a refusal names the field (400 INVALID_INPUT,
// details.field), so the form can show it there.
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const validateEmail = require('../../core/utils/validateEmail');

const refuse = (field, message) => ApiError.withCode(httpStatus.BAD_REQUEST, message, 'INVALID_INPUT', { field });

// The trimmed text of a field; null when it is empty and not required.
const text = (body, field, { required = false, max = 255, label = field } = {}) => {
    const value = body[field] === undefined || body[field] === null ? '' : String(body[field]).trim();
    if (!value) {
        if (required) throw refuse(field, `${label} is required.`);
        return null;
    }
    if (value.length > max) throw refuse(field, `${label} is at most ${max} characters.`);
    return value;
};

// A valid email address, lower-cased.
const email = (body, field = 'email') => {
    const value = text(body, field, { required: true, max: 200, label: 'Email' }).toLowerCase();
    if (!validateEmail(value)) throw refuse(field, 'Please enter a valid email address.');
    return value;
};

// A phone number as typed, with at least 7 digits in it.
const phone = (body, field = 'phone', { required = false } = {}) => {
    const value = text(body, field, { required, max: 30, label: 'Phone number' });
    if (value && value.replace(/\D/g, '').length < 7) throw refuse(field, 'Please enter a valid phone number.');
    return value;
};

// A list (or an object) sent as JSON, as multipart forms send them: parsed, checked for its kind and size.
// Null when the field is empty.
const json = (body, field, { kind = 'list', maxItems = 20, maxLength = 20000 } = {}) => {
    let value = body[field];
    if (value === undefined || value === null || value === '') return null;
    if ((typeof value === 'string' ? value : JSON.stringify(value)).length > maxLength) throw refuse(field, `${field} is too long.`);
    if (typeof value === 'string') {
        try {
            value = JSON.parse(value);
        } catch {
            throw refuse(field, `${field} must be JSON.`);
        }
    }
    const fits = kind === 'list' ? Array.isArray(value) : value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!fits) throw refuse(field, `${field} must be ${kind === 'list' ? 'a list' : 'an object'}.`);
    if (kind === 'list' && value.length > maxItems) throw refuse(field, `At most ${maxItems} items in ${field}.`);
    return value;
};

module.exports = { refuse, text, email, phone, json };
