// Admins and pages: every page and how it stands, a brand page for a brand with no login yet (it claims the page
// with a "Set your password" email), and what is set on any page (slug, listing, featuring, its own fields). Since
// Nov 24: a brand page may be made without an email (the CSV import, brandImport.js, makes many), and an admin sets or
// corrects the email of an account nobody has signed in to; a professional's pin comes off the directory map.
const { Op } = require('sequelize');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const sequelize = require('../../core/db/central.db');
const { paging } = require('../../core/http/paging');
const { isYes } = require('../../core/utils/formValues');
const { toSlug } = require('../../core/utils/slug');
const validateEmail = require('../../core/utils/validateEmail');
const { User, Profile, ProfilePage } = require('../../models');
const { createAccount, normalizeEmail, setPasswordLink, revokeEmailTokens, professionalAccount } = require('../../shared/identity');
const { sendProfileInviteEmail } = require('../../integrations/mailer/email.service');
const { pageList, pageOf, slugTaken } = require('./profileQuery');
const { toRow, toDetail } = require('./profilePublic');
const { pageFields, pageFiles, refuse, empty } = require('./pageFields');
const { topicsOf } = require('./profile.service');

const notFound = () => ApiError.withCode(httpStatus.NOT_FOUND, 'No page for this account.', 'NOT_FOUND');

// Every page, listed or not, with how it stands: listed, featured, made by an admin, a live card, shown, claimed; since
// Nov 24 on the directory map or not (`on_map=true|false` lists only those) and the account's email (null: none yet).
const listPages = async (query = {}) => {
    const { limit, offset } = paging(query, { defaultLimit: 50 });
    const onMap = query.on_map === undefined || query.on_map === '' ? null : isYes(query.on_map);
    const { count, rows } = await pageList({
        type: ['brand', 'individual'].includes(query.type) ? query.type : null,
        featured: isYes(query.featured),
        search: String(query.search ?? '').trim() || null,
        limit,
        offset,
        admin: true,
        onMap,
    });
    return {
        count,
        rows: rows.map((row) => ({
            ...toRow(row),
            featured_order: Number(row.featured_order),
            is_listed: Boolean(Number(row.is_listed)),
            is_on_map: Boolean(Number(row.is_on_map)),
            created_by_admin: Boolean(Number(row.created_by_admin)),
            has_live_card: Boolean(Number(row.has_live_card)),
            visible: Boolean(Number(row.visible)),
            claimed: Boolean(Number(row.claimed)),
            email: row.email || null,
        })),
    };
};

// One account's page as an admin (or its owner) sees it: what is set on it, what the public sees, and whether it shows.
const pageView = async (userId) => {
    const row = await pageOf(userId);
    if (!row) throw notFound();
    const [page, account] = await Promise.all([
        ProfilePage.findByPk(userId),
        professionalAccount(userId, { attributes: ['id', 'email', 'password'] }),
    ]);
    const visible = Boolean(Number(row.visible));
    let hiddenBecause = null;
    if (!visible) hiddenBecause = Number(row.page_exists) ? 'unlisted' : 'no_live_card';
    return {
        user_id: Number(row.id),
        slug: row.slug,
        // Nov 24: the account's sign-in email (null: none yet), and whether anyone has signed in (set a password). An
        // admin may set the email until then.
        email: account?.email ?? null,
        claimed: Boolean(account?.password),
        page: {
            slug: page?.slug ?? null,
            is_listed: page ? page.is_listed : true,
            is_on_map: page ? page.is_on_map : true,
            is_featured: page ? page.is_featured : false,
            featured_order: page ? page.featured_order : 0,
            created_by_admin: page ? page.created_by_admin : false,
            tagline: page?.tagline ?? null,
            intro: page?.intro ?? null,
            category: page?.category ?? null,
            shipping: page?.shipping ?? null,
            about: page?.about ?? null,
            image: page?.image ?? null,
            cover_image: page?.cover_image ?? null,
            about_image: page?.about_image ?? null,
            website: page?.website ?? null,
            social: page?.social ?? null,
        },
        visible,
        hidden_because: hiddenBecause,
        public: toDetail(row, { topics: await topicsOf(row.id) }),
    };
};

// Saves what is set on an account's page (a row is made the first time). A new slug must be free.
const savePage = async (userId, fields) => {
    if (fields.slug && (await slugTaken(fields.slug, userId))) throw refuse('slug', 'This slug is taken.');
    const page = await ProfilePage.findByPk(userId);
    if (page) await page.update(fields);
    else await ProfilePage.create({ user_id: userId, ...fields });
};

// A professional account (individual or brand), or 404; one without an email too (Nov 24).
const professional = async (userId) => {
    const user = await professionalAccount(userId, { attributes: ['id', 'email', 'password', 'professional_type'] });
    if (!user) throw notFound();
    return user;
};

// An email for a new or login-less account: null when empty, else checked; 409 ACCOUNT_EXISTS when another account has it.
const freeEmail = async (value, userId = null) => {
    if (empty(value)) return null;
    const email = normalizeEmail(value);
    if (!validateEmail(email) || email.length > 200) throw refuse('email', 'Please enter a valid email address.');
    const existing = await User.findOne({ where: { email, ...(userId && { id: { [Op.ne]: userId } }) }, attributes: ['id'] });
    if (existing) {
        throw ApiError.withCode(httpStatus.CONFLICT, 'This email already has an account: edit its page instead.', 'ACCOUNT_EXISTS', { user_id: existing.id });
    }
    return email;
};

// Nov 24: the email of a brand page an admin made, set or corrected by an admin (`""` clears it) while nobody has signed
// in to it and it has no Access card. Answers the new email (null: none), or undefined when it does not change. Any
// other account's email is its owner's: 409 ALREADY_CLAIMED once someone has signed in (a password), 409
// EMAIL_NOT_EDITABLE for an account an admin did not make as a brand page, or one with a card (its payments and emails
// go by its email).
const newEmail = async (user, value) => {
    const email = await freeEmail(value, user.id);
    if (email === (user.email || null)) return undefined;
    if (user.password) throw ApiError.withCode(httpStatus.CONFLICT, 'Someone has signed in to this account: its owner changes the email.', 'ALREADY_CLAIMED');
    const page = await ProfilePage.findByPk(user.id, { attributes: ['user_id', 'created_by_admin'] });
    const [[card]] = await sequelize.query('SELECT id FROM business_cards WHERE user_id = :id AND deleted_at IS NULL LIMIT 1', { replacements: { id: user.id } });
    if (!page?.created_by_admin || card) {
        throw ApiError.withCode(httpStatus.CONFLICT, 'Only a brand page Glamlink made, with no Access card, has its email set here.', 'EMAIL_NOT_EDITABLE');
    }
    return email;
};

// Sets it on the account and its profile; links already sent to the old address stop working.
const setEmail = async (user, email) => {
    await sequelize.transaction(async (transaction) => {
        await user.update({ email }, { transaction });
        await Profile.update({ email }, { where: { user_id: user.id }, transaction });
    });
    await revokeEmailTokens(user.id);
};

// PUT /profiles/admin/:userId: the owner's fields, the admin's, and images as links or, as the owner sends them, files.
// Since Nov 24, `email` for an account nobody has signed in to (checked before anything is saved).
const updatePage = async (userId, body, files = {}) => {
    const user = await professional(userId);
    const fields = { ...pageFields(body, { admin: true, type: user.professional_type }), ...pageFiles(files) };
    const email = body.email === undefined ? undefined : await newEmail(user, body.email);
    await savePage(userId, fields);
    if (email !== undefined) await setEmail(user, email);
    return pageView(userId);
};

// A free slug from a name: kate-sue-beauty, then kate-sue-beauty-2, ... `reserved`: slugs already given out in this
// request (the CSV import's earlier rows), taken too.
const freeSlugFor = async (name, reserved = new Set()) => {
    const base = toSlug(name).slice(0, 55) || 'brand';
    for (let n = 1; ; n++) {
        const candidate = n === 1 ? base : `${base}-${n}`;
        if (!reserved.has(candidate) && !(await slugTaken(candidate))) return candidate;
    }
};

// An explicit slug for an account whose page may have no card to take one from (an approved directory listing's): its
// card's handle when it ever had one (it stays theirs), else a free slug from its name. Answers the slug.
const ensurePageSlug = async (userId, name) => {
    const page = await ProfilePage.findByPk(userId);
    if (page?.slug) return page.slug;
    const [card] = (await sequelize.query('SELECT slug FROM business_cards WHERE user_id = :id AND slug IS NOT NULL ORDER BY id DESC LIMIT 1', { replacements: { id: userId } }))[0];
    const slug = card?.slug && !(await slugTaken(card.slug, userId)) ? card.slug : await freeSlugFor(name);
    await savePage(userId, { slug });
    return slug;
};

// A brand's name: 1 to 150 characters.
const brandName = (value) => {
    const name = String(value ?? '').trim();
    if (!name || name.length > 150) throw refuse('name', 'name is 1 to 150 characters.');
    return name;
};

// Makes a brand account without a password and its admin-made page (shown without a card), in one transaction, from
// checked values: { name, email (or null), fields (pageFields, with a free slug) }. Returns the account.
const makeBrandPage = ({ name, email, fields }) =>
    sequelize.transaction(async (transaction) => {
        const user = await createAccount({ email, name, accountType: 'professional', professionalType: 'brand', transaction });
        await ProfilePage.create({ user_id: user.id, ...fields, created_by_admin: true }, { transaction });
        return user;
    });

// A brand page before the brand has a login. The email is optional since Nov 24 (Mohit): without one the page shows,
// and an admin adds the email (PUT /profiles/admin/:userId) before inviting.
const createBrandPage = async (body) => {
    const name = brandName(body.name);
    const email = await freeEmail(body.email);
    const fields = pageFields(body, { admin: true, type: 'brand' });
    fields.slug = fields.slug || (await freeSlugFor(name));
    if (await slugTaken(fields.slug)) throw refuse('slug', 'This slug is taken.');
    const user = await makeBrandPage({ name, email, fields });
    return pageView(user.id);
};

// Emails the account a "Set your password" link (7 days), so the brand can sign in and edit its page.
const invite = async (userId) => {
    const user = await professional(userId);
    if (user.password) throw ApiError.withCode(httpStatus.CONFLICT, 'This account already has a password: it can sign in.', 'ALREADY_CLAIMED');
    if (!user.email) throw ApiError.withCode(httpStatus.CONFLICT, 'This account has no email yet: add one to the page first.', 'NO_EMAIL');
    const view = await pageView(userId);
    await sendProfileInviteEmail({ to: user.email, name: view.public.name, link: await setPasswordLink(user) });
    return { sent: true, email: user.email };
};

module.exports = {
    listPages, pageView, savePage, updatePage, createBrandPage, makeBrandPage, brandName, freeEmail, freeSlugFor, invite, ensurePageSlug, professional,
};
