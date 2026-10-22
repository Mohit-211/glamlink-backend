// Admins and pages: every page and how it stands, a brand page for a brand with no login yet (it claims the page
// with a "Set your password" email), and what is set on any page (slug, listing, featuring, its own fields).
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const { paging } = require('../../core/http/paging');
const { isYes } = require('../../core/utils/formValues');
const { toSlug } = require('../../core/utils/slug');
const validateEmail = require('../../core/utils/validateEmail');
const { User, ProfilePage } = require('../../models');
const { createAccount, normalizeEmail, setPasswordLink } = require('../../shared/identity');
const { sendProfileInviteEmail } = require('../../integrations/mailer/email.service');
const { pageList, pageOf, slugTaken } = require('./profileQuery');
const { toRow, toDetail } = require('./profilePublic');
const { pageFields, refuse } = require('./pageFields');
const { topicsOf } = require('./profile.service');

const notFound = () => ApiError.withCode(httpStatus.NOT_FOUND, 'No page for this account.', 'NOT_FOUND');

// Every page, listed or not, with how it stands: listed, featured, made by an admin, a live card, shown, claimed.
const listPages = async (query = {}) => {
    const { limit, offset } = paging(query, { defaultLimit: 50 });
    const { count, rows } = await pageList({
        type: ['brand', 'individual'].includes(query.type) ? query.type : null,
        featured: isYes(query.featured),
        search: String(query.search ?? '').trim() || null,
        limit,
        offset,
        admin: true,
    });
    return {
        count,
        rows: rows.map((row) => ({
            ...toRow(row),
            featured_order: Number(row.featured_order),
            is_listed: Boolean(Number(row.is_listed)),
            created_by_admin: Boolean(Number(row.created_by_admin)),
            has_live_card: Boolean(Number(row.has_live_card)),
            visible: Boolean(Number(row.visible)),
            claimed: Boolean(Number(row.claimed)),
        })),
    };
};

// One account's page as an admin (or its owner) sees it: what is set on it, what the public sees, and whether it shows.
const pageView = async (userId) => {
    const row = await pageOf(userId);
    if (!row) throw notFound();
    const page = await ProfilePage.findByPk(userId);
    const visible = Boolean(Number(row.visible));
    let hiddenBecause = null;
    if (!visible) hiddenBecause = Number(row.page_exists) ? 'unlisted' : 'no_live_card';
    return {
        user_id: Number(row.id),
        slug: row.slug,
        page: {
            slug: page?.slug ?? null,
            is_listed: page ? page.is_listed : true,
            is_featured: page ? page.is_featured : false,
            featured_order: page ? page.featured_order : 0,
            created_by_admin: page ? page.created_by_admin : false,
            tagline: page?.tagline ?? null,
            about: page?.about ?? null,
            image: page?.image ?? null,
            cover_image: page?.cover_image ?? null,
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

// A professional account (individual or brand), or 404.
const professional = async (userId) => {
    const user = await User.findOne({ where: { id: userId, account_type: 'professional', is_active: true }, attributes: ['id', 'email', 'password'] });
    if (!user) throw notFound();
    return user;
};

const updatePage = async (userId, body) => {
    await professional(userId);
    await savePage(userId, pageFields(body, { admin: true }));
    return pageView(userId);
};

// A free slug from a name: kate-sue-beauty, then kate-sue-beauty-2, ...
const freeSlugFor = async (name) => {
    const base = toSlug(name).slice(0, 55) || 'brand';
    for (let n = 1; ; n++) {
        const candidate = n === 1 ? base : `${base}-${n}`;
        if (!(await slugTaken(candidate))) return candidate;
    }
};

// A brand page before the brand has a login: a brand account without a password and its page, shown without a card.
const createBrandPage = async (body) => {
    const name = String(body.name ?? '').trim();
    if (!name || name.length > 150) throw refuse('name', 'name is 1 to 150 characters.');
    const email = normalizeEmail(body.email);
    if (!validateEmail(email)) throw refuse('email', 'Please enter a valid email address.');
    const existing = await User.findOne({ where: { email }, attributes: ['id'] });
    if (existing) {
        throw ApiError.withCode(httpStatus.CONFLICT, 'This email already has an account: edit its page instead.', 'ACCOUNT_EXISTS', { user_id: existing.id });
    }
    const fields = pageFields(body, { admin: true });
    fields.slug = fields.slug || (await freeSlugFor(name));
    if (await slugTaken(fields.slug)) throw refuse('slug', 'This slug is taken.');
    const user = await createAccount({ email, name, accountType: 'professional', professionalType: 'brand' });
    await ProfilePage.create({ user_id: user.id, ...fields, created_by_admin: true });
    return pageView(user.id);
};

// Emails the account a "Set your password" link (7 days), so the brand can sign in and edit its page.
const invite = async (userId) => {
    const user = await professional(userId);
    if (user.password) throw ApiError.withCode(httpStatus.CONFLICT, 'This account already has a password: it can sign in.', 'ALREADY_CLAIMED');
    const view = await pageView(userId);
    await sendProfileInviteEmail({ to: user.email, name: view.public.name, link: await setPasswordLink(user) });
    return { sent: true, email: user.email };
};

module.exports = { listPages, pageView, savePage, updatePage, createBrandPage, invite };
