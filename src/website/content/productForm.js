// What the admin and owner product forms share (Mohit, Nov 4): a category from a fixed list of 8, stored as its label
// (values stored before stay until the product is edited), and the product's button label (the website shows
// "Shop now" without one). Tags have their own rules (productTags.service.js).
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const { toSlug } = require('../../core/utils/slug');

const PRODUCT_CATEGORIES = ['Skincare', 'Haircare', 'Makeup', 'Nails', 'Body & Bath', 'Fragrance', 'Wellness & Supplements', 'Devices & Tools'];
const BUTTON_LABEL = 30;

const refuse = (field, message) => ApiError.withCode(httpStatus.BAD_REQUEST, message, 'INVALID_PRODUCT', { field });

// Every way a form or the shop's list may name a category: its label in any case, its slug as the shop's lists make it
// ("body-and-bath"), and that slug without the "and" ("body-bath").
const NAMES = new Map(PRODUCT_CATEGORIES.flatMap((label) => [label.toLowerCase(), toSlug(label), toSlug(label.replace(/&/g, ' '))]
    .map((name) => [name, label])));

// The label of the category a value names, or null when it names none of the 8.
const productCategory = (value) => {
    const text = String(value ?? '').trim();
    return NAMES.get(text.toLowerCase()) ?? NAMES.get(toSlug(text)) ?? null;
};

// A product's category from a form: the label, or null ("" clears it); anything else is a 400.
const categoryField = (value) => {
    if (value === null || String(value).trim() === '') return null;
    const label = productCategory(value);
    if (!label) throw refuse('category', `category is one of ${PRODUCT_CATEGORIES.join(', ')}.`);
    return label;
};

// A product's button label from a form: trimmed, at most 30 characters, or null ("" clears it).
const buttonLabelField = (value) => {
    const label = String(value ?? '').trim();
    if (!label) return null;
    if ([...label].length > BUTTON_LABEL) throw refuse('button_label', `button_label is at most ${BUTTON_LABEL} characters.`);
    return label;
};

module.exports = { PRODUCT_CATEGORIES, productCategory, categoryField, buttonLabelField };
