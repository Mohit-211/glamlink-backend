// The magazine: its issues (GET /magazine, /magazine/:slug) and who appears in them, for the magazine pages and the
// profile pages.
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const { paging } = require('../../core/http/paging');
const { isYes } = require('../../core/utils/formValues');
const { MagazineIssue, MagazineFeature } = require('../../models');
const { pageLinks } = require('../profiles');

const CARD = ['id', 'slug', 'title', 'issue_number', 'cover_image', 'publish_date', 'short_description', 'is_featured', 'publuu_account_id', 'publuu_flipbook_id', 'flipbook_url'];
// Newest first: by the admins' order (the import gives each issue its number), then the number.
const ORDER = [['sort_order', 'DESC'], ['issue_number', 'DESC'], ['id', 'DESC']];
const ROLE_ORDER = { cover: 0, featured: 1, mentioned: 2 };

// The flipbook to embed: Publuu's, or a link.
const flipbookOf = (issue) => {
    if (issue.flipbook_url) return { url: issue.flipbook_url };
    if (issue.publuu_account_id && issue.publuu_flipbook_id) {
        return {
            publuu_account_id: issue.publuu_account_id,
            publuu_flipbook_id: issue.publuu_flipbook_id,
            url: `https://publuu.com/flip-book/${issue.publuu_account_id}/${issue.publuu_flipbook_id}/page/1?embed`,
        };
    }
    return null;
};

const toCard = (issue) => ({
    id: issue.id,
    slug: issue.slug,
    title: issue.title,
    issue_number: issue.issue_number,
    cover_image: issue.cover_image,
    publish_date: issue.publish_date,
    short_description: issue.short_description,
    is_featured: Boolean(issue.is_featured),
    flipbook: flipbookOf(issue),
});

// One page of published issues, newest first (featured=true: only featured ones).
const listIssues = async (query = {}) => {
    const { limit, offset } = paging(query);
    const where = { status: 'published', ...(isYes(query.featured) && { is_featured: true }) };
    const { count, rows } = await MagazineIssue.findAndCountAll({ attributes: CARD, where, order: ORDER, limit, offset });
    return { count, rows: rows.map(toCard) };
};

// Who appears in an issue and has a visible page: [{ id, slug, name, type, role, page_number }], cover first.
const featuresOf = async (issueId) => {
    const rows = await MagazineFeature.findAll({ where: { issue_id: issueId } });
    const links = await pageLinks(rows.map((row) => row.user_id));
    return rows
        .filter((row) => links.has(Number(row.user_id)))
        .toSorted((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || (a.page_number ?? 1e9) - (b.page_number ?? 1e9) || a.id - b.id)
        .map((row) => ({ ...links.get(Number(row.user_id)), role: row.role, page_number: row.page_number }));
};

// One published issue, with who appears in it.
const getIssue = async (slug) => {
    const issue = await MagazineIssue.findOne({ where: { slug: String(slug), status: 'published' }, attributes: CARD });
    if (!issue) throw ApiError.withCode(httpStatus.NOT_FOUND, 'Issue not found.', 'NOT_FOUND');
    return { ...toCard(issue), features: await featuresOf(issue.id) };
};

// The published issues an account appears in (profile pages), newest first, each with the account's role.
const issuesOfAccount = async (userId, query = {}) => {
    const features = await MagazineFeature.findAll({ where: { user_id: userId }, attributes: ['issue_id', 'role', 'page_number'] });
    if (!features.length) return { count: 0, rows: [] };
    const { limit, offset } = paging(query);
    const { count, rows } = await MagazineIssue.findAndCountAll({
        attributes: CARD,
        where: { status: 'published', id: features.map((f) => f.issue_id) },
        order: ORDER,
        limit,
        offset,
    });
    const byIssue = new Map(features.map((f) => [f.issue_id, f]));
    return { count, rows: rows.map((issue) => ({ ...toCard(issue), role: byIssue.get(issue.id).role, page_number: byIssue.get(issue.id).page_number })) };
};

// The sitemap's issues: every published issue's id, slug and date of last change.
const sitemapIssues = () =>
    MagazineIssue.findAll({ attributes: ['id', 'slug', 'updated_at'], where: { status: 'published' }, order: [['id', 'ASC']], raw: true });

module.exports = { listIssues, getIssue, issuesOfAccount, featuresOf, sitemapIssues, toCard, CARD, ORDER };
