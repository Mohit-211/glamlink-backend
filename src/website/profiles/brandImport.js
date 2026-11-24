// Brands in bulk (Mohit, Nov 24): an admin uploads a CSV of brands and each row becomes a brand page without a login, as
// "Add brand" makes one (profileAdmin.service.js). The email is optional: without one the page shows, and an admin adds
// the email before inviting the brand to claim it. A dry run checks every row and makes nothing.
//
// Each row ends as one of:
//   created / ready (dry run)  the brand page was made / would be made
//   skipped   nothing wrong, but already here: its email has an account (ACCOUNT_EXISTS), or a brand of that name
//             exists (BRAND_EXISTS). Importing the same file twice therefore adds nothing the second time.
//   failed    fix the row and upload again: no name, a bad email, a slug that is taken, a text over its limit, or a
//             name or email an earlier row of the file already has (DUPLICATE_IN_FILE)
// Rows are numbered as in the spreadsheet (the header is row 1); empty rows are left out.
// and a row may carry `warnings`: a value that was left out (a link that isn't one, an unknown category or shipping, an
// image that isn't an upload on the API), the brand being made without it.
const { parse } = require('csv-parse/sync');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const logger = require('../../core/logger');
const { toCsv } = require('../../core/utils/csv');
const { User } = require('../../models');
const { normalizeEmail } = require('../../shared/identity');
const { pageFields } = require('./pageFields');
const { brandNames, slugTaken } = require('./profileQuery');
const { makeBrandPage, brandName, freeSlugFor } = require('./profileAdmin.service');
const { BRAND_CATEGORIES, SHIPPING } = require('./quickInfo');
const validateEmail = require('../../core/utils/validateEmail');

const MAX_ROWS = 500;
const MAX_BYTES = 2 * 1024 * 1024;

const invalidCsv = (message, details) => ApiError.withCode(httpStatus.BAD_REQUEST, message, 'INVALID_CSV', details);

// The columns, in the template's order, with the headers each also answers to (compared in lower case, any run of
// spaces or punctuation as one _).
const COLUMNS = {
    name: ['name', 'brand', 'brand_name', 'business_name', 'company'],
    email: ['email', 'e_mail', 'email_address', 'contact_email'],
    website: ['website', 'website_url', 'url', 'site'],
    instagram: ['instagram', 'instagram_handle', 'ig'],
    tiktok: ['tiktok', 'tik_tok'],
    facebook: ['facebook'],
    youtube: ['youtube'],
    linkedin: ['linkedin'],
    category: ['category'],
    shipping: ['shipping'],
    tagline: ['tagline'],
    intro: ['intro', 'short_description', 'summary'],
    about: ['about', 'description', 'bio'],
    slug: ['slug'],
    listed: ['listed', 'is_listed'],
    featured: ['featured', 'is_featured'],
    image: ['image', 'logo'],
    cover_image: ['cover_image', 'cover'],
};
const HEADER_KEY = Object.fromEntries(Object.entries(COLUMNS).flatMap(([key, names]) => names.map((name) => [name, key])));
const headerName = (header) => String(header ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const SOCIAL = {
    instagram: { title: 'Instagram', url: (handle) => `https://www.instagram.com/${handle}` },
    tiktok: { title: 'TikTok', url: (handle) => `https://www.tiktok.com/@${handle}` },
    facebook: { title: 'Facebook', url: (handle) => `https://www.facebook.com/${handle}` },
    youtube: { title: 'YouTube', url: (handle) => `https://www.youtube.com/@${handle}` },
    linkedin: { title: 'LinkedIn', url: (handle) => `https://www.linkedin.com/company/${handle}` },
};

// A brand category by its key ("skincare") or label ("Body & Bath", "Skincare Brand"); shipping by key or label.
const plain = (value) => String(value).trim().toLowerCase().replace(/\s+brand$/, '').replace(/\s+/g, ' ');
const CATEGORY_KEYS = new Map(Object.entries(BRAND_CATEGORIES).flatMap(([key, label]) => [[key, key], [plain(label), key]]));
const SHIPPING_KEYS = new Map(Object.entries(SHIPPING).flatMap(([key, label]) => [[key, key], [plain(label), key]]));

const YES = ['yes', 'y', 'true', '1'];
const NO = ['no', 'n', 'false', '0'];

// A name as the import compares names: case, accents, punctuation and spacing aside ("Glow  Co." is "glow co"), letters
// of any script kept. Empty for a name of punctuation only: such a name is compared with nothing.
const sameName = (name) => String(name ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// The file's text: UTF-8, else Windows-1252 (Excel's plain "CSV" on Windows), without a byte-order mark.
const textOf = (input) => {
    if (typeof input === 'string') return input.replace(/^\uFEFF/, '');
    if (!Buffer.isBuffer(input)) throw invalidCsv('Send the CSV as the file csv_file (or its text as csv).');
    if (input.length > MAX_BYTES) throw invalidCsv('The file is over 2 MB: split it.');
    let text;
    try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(input);
    } catch {
        text = new TextDecoder('windows-1252').decode(input);
    }
    return text.replace(/^\uFEFF/, '');
};

// The delimiter the header line uses most: a comma, or a semicolon or a tab (spreadsheets in some languages).
const delimiterOf = (text) => {
    const header = text.slice(0, text.search(/\r?\n|$/));
    const counts = [',', ';', '\t'].map((d) => [d, header.split(d).length - 1]);
    return counts.reduce((best, next) => (next[1] > best[1] ? next : best))[0];
};

// { headers, records: [{ row, cells }] }, or 400 INVALID_CSV. `row` is the spreadsheet's row (the header is row 1), right
// even when a cell holds line breaks. Rows with nothing in them (spreadsheets export some at the end) are left out.
const readCsv = (input) => {
    const text = textOf(input);
    if (Buffer.byteLength(text) > MAX_BYTES) throw invalidCsv('The file is over 2 MB: split it.');
    if (!text.trim()) throw invalidCsv('The file is empty.');
    let rows;
    try {
        rows = parse(text, { delimiter: delimiterOf(text), relax_column_count: true, trim: true });
    } catch (err) {
        throw invalidCsv(`The file could not be read as CSV (near line ${err.lines ?? '?'}): ${err.message}`);
    }
    const [header = [], ...records] = rows;
    return {
        headers: header,
        records: records.map((cells, index) => ({ row: index + 2, cells })).filter(({ cells }) => cells.some((cell) => String(cell).trim())),
    };
};

// A cell's value: trimmed, without the ' a spreadsheet export puts before = + - @ (core/utils/csv.js).
const cellValue = (value) => {
    const text = String(value ?? '').trim();
    return /^'[=+\-@]/.test(text) ? text.slice(1) : text;
};

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// The About text: HTML as written, or plain text as paragraphs (a blank line between them, line breaks kept).
const aboutHtml = (text) => {
    if (!text || /<[a-z][^>]*>/i.test(text)) return text;
    return text.split(/\r?\n\s*\r?\n/).map((p) => p.trim()).filter(Boolean)
        .map((p) => `<p>${escapeHtml(p).replace(/\r?\n/g, '<br>')}</p>`).join('');
};

// A social column's link: a link as written, or a handle ("@glow", "glow") made into the platform's link.
const socialLink = (key, value) => {
    if (/^https?:\/\//i.test(value) || /^[\w.-]+\.[a-z]{2,}\//i.test(value)) return value;
    const handle = value.replace(/^@/, '');
    return /^[\w.-]{1,100}$/.test(handle) ? SOCIAL[key].url(handle) : value;
};

// One row's values as the page's fields (pageFields checks them), with what was left out as warnings. Throws
// INVALID_PAGE for what fails the row: no name, a text over its limit, a bad slug.
const rowToBrand = (values) => {
    const warnings = [];
    const name = brandName(values.name);
    const body = {};
    for (const key of ['tagline', 'intro', 'slug']) if (values[key]) body[key] = values[key];
    if (values.about) body.about = aboutHtml(values.about);
    // What may be left out with a warning, each checked on its own.
    const tryField = (field, value, check) => {
        if (!value) return;
        try {
            body[field] = check(value);
        } catch (err) {
            warnings.push(`${field}: ${err.message} (left out)`);
        }
    };
    tryField('website', values.website, (value) => pageFields({ website: value }).website);
    const social = Object.keys(SOCIAL).filter((key) => values[key]).map((key) => ({ title: SOCIAL[key].title, url: socialLink(key, values[key]) }))
        .filter((link) => {
            try {
                pageFields({ social: [link] });
                return true;
            } catch (err) {
                warnings.push(`${link.title}: ${err.message} (left out)`);
                return false;
            }
        });
    if (social.length) body.social = social;
    if (values.category) {
        const key = CATEGORY_KEYS.get(plain(values.category));
        if (key) body.category = key;
        else warnings.push(`category: "${values.category}" is not one of ${Object.keys(BRAND_CATEGORIES).join(', ')} (left out)`);
    }
    if (values.shipping) {
        const key = SHIPPING_KEYS.get(plain(values.shipping));
        if (key) body.shipping = key;
        else warnings.push(`shipping: "${values.shipping}" is not one of ${Object.keys(SHIPPING).join(', ')} (left out)`);
    }
    for (const [column, field, fallback] of [['listed', 'is_listed', true], ['featured', 'is_featured', false]]) {
        const value = values[column]?.toLowerCase();
        if (!value) continue;
        if (YES.includes(value)) body[field] = true;
        else if (NO.includes(value)) body[field] = false;
        else warnings.push(`${column}: "${values[column]}" is not yes or no (${fallback ? 'yes' : 'no'} used)`);
    }
    for (const field of ['image', 'cover_image']) tryField(field, values[field], (value) => pageFields({ [field]: value })[field]);
    // The rest is checked as one admin's page edit: lengths and the slug fail the row.
    const fields = pageFields(body, { admin: true, type: 'brand' });
    return { name, fields, warnings };
};

const failure = (row, err) => {
    if (err instanceof ApiError && err.code) {
        return { ...row, status: 'failed', code: err.code, field: err.details?.field ?? null, message: err.message };
    }
    logger.error(`Brand import, row ${row.row}`, err);
    return { ...row, status: 'failed', code: 'ERROR', field: null, message: 'This row could not be imported.' };
};

/**
 * Imports the brands of a CSV (a Buffer or its text). `dryRun`: check every row, make nothing. Answers
 * { dry_run, total, created, ready, skipped, failed, with_warnings, ignored_columns, rows: [{ row (the spreadsheet's),
 * name, email, status, code, field, message, user_id, slug, warnings }] }.
 */
const importBrands = async (input, { dryRun = false } = {}) => {
    const { headers, records } = readCsv(input);
    const keys = headers.map((header) => HEADER_KEY[headerName(header)] ?? null);
    if (!keys.includes('name')) throw invalidCsv('The file needs a "name" column (download the template).', { field: 'name' });
    if (!records.length) throw invalidCsv('The file has a header but no brands.');
    if (records.length > MAX_ROWS) throw invalidCsv(`At most ${MAX_ROWS} brands per file: split it.`);
    const ignored = headers.filter((header, i) => header && !keys[i]);

    // What is already here: brand names, and the accounts of the file's emails.
    const existingNames = new Map((await brandNames()).map((brand) => [sameName(brand.name), Number(brand.id)]).filter(([key]) => key));
    const emails = [...new Set(records.flatMap(({ cells }) => {
        const at = keys.indexOf('email');
        const email = at === -1 ? '' : normalizeEmail(cellValue(cells[at]));
        return email ? [email] : [];
    }))];
    const accounts = emails.length ? await User.findAll({ where: { email: emails }, attributes: ['id', 'email'] }) : [];
    const existingEmails = new Map(accounts.map((account) => [normalizeEmail(account.email), Number(account.id)]));

    const seenNames = new Map();
    const seenEmails = new Map();
    const reservedSlugs = new Set();
    const rows = [];
    for (const { row: line, cells } of records) {
        const values = {};
        keys.forEach((key, i) => {
            if (key && values[key] === undefined) values[key] = cellValue(cells[i]);
        });
        const email = values.email ? normalizeEmail(values.email) : null;
        const row = { row: line, name: values.name || null, email, status: null, code: null, field: null, message: null, user_id: null, slug: null, warnings: [] };
        if (cells.length > headers.length && cells.slice(headers.length).some((cell) => String(cell).trim())) {
            rows.push({ ...row, status: 'failed', code: 'INVALID_CSV', message: 'This row has more values than the header has columns: a value with a comma needs quotes.' });
            continue;
        }
        try {
            const brand = rowToBrand(values);
            row.warnings = brand.warnings;
            if (email && (!validateEmail(email) || email.length > 200)) {
                rows.push({ ...row, status: 'failed', code: 'INVALID_PAGE', field: 'email', message: 'Please enter a valid email address.' });
                continue;
            }
            const nameKey = sameName(brand.name);
            if (email && existingEmails.has(email)) {
                rows.push({ ...row, status: 'skipped', code: 'ACCOUNT_EXISTS', message: 'This email already has an account.', user_id: existingEmails.get(email) });
                continue;
            }
            if (nameKey && existingNames.has(nameKey)) {
                rows.push({ ...row, status: 'skipped', code: 'BRAND_EXISTS', message: `A brand named "${brand.name}" is already here.`, user_id: existingNames.get(nameKey) });
                continue;
            }
            const earlier = (nameKey && seenNames.get(nameKey)) || (email && seenEmails.get(email));
            if (earlier) {
                const field = nameKey && seenNames.has(nameKey) ? 'name' : 'email';
                rows.push({ ...row, status: 'failed', code: 'DUPLICATE_IN_FILE', field, message: `Row ${earlier} has this ${field} already.` });
                continue;
            }
            if (brand.fields.slug && (reservedSlugs.has(brand.fields.slug) || (await slugTaken(brand.fields.slug)))) {
                rows.push({ ...row, status: 'failed', code: 'INVALID_PAGE', field: 'slug', message: 'This slug is taken.' });
                continue;
            }
            const fields = { ...brand.fields, slug: brand.fields.slug || (await freeSlugFor(brand.name, reservedSlugs)) };
            reservedSlugs.add(fields.slug);
            if (nameKey) seenNames.set(nameKey, line);
            if (email) seenEmails.set(email, line);
            if (dryRun) {
                rows.push({ ...row, status: 'ready', slug: fields.slug });
                continue;
            }
            const user = await makeBrandPage({ name: brand.name, email, fields });
            rows.push({ ...row, status: 'created', user_id: Number(user.id), slug: fields.slug });
        } catch (err) {
            rows.push(failure(row, err));
        }
    }
    const count = (status) => rows.filter((row) => row.status === status).length;
    return {
        dry_run: dryRun,
        total: rows.length,
        created: count('created'),
        ready: count('ready'),
        skipped: count('skipped'),
        failed: count('failed'),
        with_warnings: rows.filter((row) => row.warnings.length).length,
        ignored_columns: ignored,
        rows,
    };
};

// The template: every column, and one example brand.
const TEMPLATE_ROW = {
    name: 'Glow Botanics',
    email: 'hello@glowbotanics.example',
    website: 'glowbotanics.example',
    instagram: 'glowbotanics',
    tiktok: '',
    facebook: '',
    youtube: '',
    linkedin: '',
    category: 'skincare',
    shipping: 'nationwide',
    tagline: 'Clean skincare, made in small batches',
    intro: 'Botanical skincare for sensitive skin, from Las Vegas.',
    about: 'Glow Botanics makes gentle cleansers and serums.\n\nEvery product is tested by estheticians.',
    slug: '',
    listed: 'yes',
    featured: 'no',
    image: '',
    cover_image: '',
};
const template = () => toCsv(Object.keys(COLUMNS).map((key) => ({ key, label: key })), [TEMPLATE_ROW]);

module.exports = { importBrands, template, MAX_ROWS };
