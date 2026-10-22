// Admins and the magazine: every issue, adding and editing one (its cover an upload), deleting one, and who appears
// in it.
const { Op } = require('sequelize');
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const { paging } = require('../../core/http/paging');
const { containing } = require('../../core/utils/like');
const { isYes, wholeNumber } = require('../../core/utils/formValues');
const { toSlug } = require('../../core/utils/slug');
const { isUploadedImage } = require('../../core/http/uploadedFiles');
const { MagazineIssue, MagazineFeature, User } = require('../../models');
const { toCard, ORDER } = require('./magazine.service');

const refuse = (field, message) => ApiError.withCode(httpStatus.BAD_REQUEST, message, 'INVALID_ISSUE', { field });
const notFound = () => ApiError.withCode(httpStatus.NOT_FOUND, 'Issue not found.', 'NOT_FOUND');

const listAll = async (query = {}) => {
    const { limit, offset } = paging(query, { defaultLimit: 50 });
    const where = {};
    if (['draft', 'published'].includes(query.status)) where.status = query.status;
    const search = String(query.search ?? '').trim();
    if (search) where.title = { [Op.like]: containing(search) };
    const { count, rows } = await MagazineIssue.findAndCountAll({ where, order: ORDER, limit, offset });
    return { count, rows: rows.map((issue) => ({ ...toCard(issue), status: issue.status, sort_order: issue.sort_order })) };
};

// One issue as admins edit it, with every feature (whether or not the account has a page).
const adminView = async (id) => {
    const issue = await MagazineIssue.findByPk(id);
    if (!issue) throw notFound();
    const features = await MagazineFeature.findAll({ where: { issue_id: issue.id }, order: [['id', 'ASC']] });
    return {
        ...toCard(issue),
        status: issue.status,
        sort_order: issue.sort_order,
        features: features.map((f) => ({ user_id: Number(f.user_id), role: f.role, page_number: f.page_number })),
    };
};

const positive = (value, field) => {
    if (value === null || value === '') return null;
    const n = wholeNumber(value);
    if (n === null || n < 0) throw refuse(field, `${field} must be a whole number.`);
    return n;
};

// The fields sent (form fields or JSON); the cover is an upload (`images`, one file) or an uploaded image's link.
const issueFields = async (body, files, id = null) => {
    const fields = {};
    if (body.title !== undefined) {
        const title = String(body.title).trim();
        if (!title || title.length > 150) throw refuse('title', 'title is 1 to 150 characters.');
        fields.title = title;
    }
    if (body.slug !== undefined || (!id && fields.title)) {
        const slug = toSlug(body.slug ?? fields.title).slice(0, 100);
        if (slug.length < 2) throw refuse('slug', 'slug is at least 2 letters, digits and dashes.');
        if (await MagazineIssue.findOne({ where: { slug, ...(id && { id: { [Op.ne]: id } }) }, attributes: ['id'] })) throw refuse('slug', 'This slug is taken.');
        fields.slug = slug;
    }
    for (const field of ['issue_number', 'publuu_account_id', 'publuu_flipbook_id', 'sort_order']) {
        if (body[field] !== undefined) fields[field] = positive(body[field], field);
    }
    if (fields.sort_order === null) fields.sort_order = 0;
    if (body.publish_date !== undefined) {
        const date = String(body.publish_date ?? '').trim();
        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw refuse('publish_date', 'publish_date is YYYY-MM-DD.');
        fields.publish_date = date || null;
    }
    if (body.flipbook_url !== undefined) {
        const url = String(body.flipbook_url ?? '').trim();
        if (url && !/^https:\/\/\S+$/i.test(url)) throw refuse('flipbook_url', 'flipbook_url is an https link.');
        fields.flipbook_url = url || null;
    }
    if (body.short_description !== undefined) fields.short_description = String(body.short_description ?? '').trim() || null;
    if (body.status !== undefined) {
        if (!['draft', 'published'].includes(body.status)) throw refuse('status', 'status is draft or published.');
        fields.status = body.status;
    }
    if (body.is_featured !== undefined) fields.is_featured = isYes(body.is_featured);
    if (files?.images?.[0]) fields.cover_image = files.images[0].filename;
    else if (body.cover_image !== undefined) {
        if (body.cover_image && !isUploadedImage(body.cover_image)) throw refuse('cover_image', 'cover_image is an image uploaded to the API.');
        fields.cover_image = body.cover_image || null;
    }
    return fields;
};

const createIssue = async (body, files) => {
    if (!body.title) throw refuse('title', 'title is required.');
    const fields = await issueFields(body, files);
    if (fields.sort_order === undefined) fields.sort_order = fields.issue_number ?? 0;
    const issue = await MagazineIssue.create(fields);
    return adminView(issue.id);
};

const updateIssue = async (id, body, files) => {
    const issue = await MagazineIssue.findByPk(id);
    if (!issue) throw notFound();
    await issue.update(await issueFields(body, files, issue.id));
    return adminView(issue.id);
};

const deleteIssue = async (id) => {
    const issue = await MagazineIssue.findByPk(id);
    if (!issue) throw notFound();
    await issue.destroy();
    return { deleted: true };
};

// Who appears in an issue, all at once: [{ user_id, role, page_number? }] (role cover, featured or mentioned).
const setFeatures = async (id, body) => {
    const issue = await MagazineIssue.findByPk(id, { attributes: ['id'] });
    if (!issue) throw notFound();
    let features = body.features;
    if (typeof features === 'string') {
        try {
            features = JSON.parse(features);
        } catch {
            features = null;
        }
    }
    if (!Array.isArray(features)) throw refuse('features', 'features is a list of { user_id, role, page_number }.');
    const rows = [];
    for (const feature of features) {
        const userId = wholeNumber(feature?.user_id);
        const role = feature?.role ?? 'featured';
        if (!['cover', 'featured', 'mentioned'].includes(role)) throw refuse('features', 'role is cover, featured or mentioned.');
        const account = userId && (await User.findOne({ where: { id: userId, account_type: 'professional', is_active: true }, attributes: ['id'] }));
        if (!account) throw refuse('features', `${feature?.user_id} is not a professional or brand account.`);
        const page = feature?.page_number === undefined ? null : positive(feature.page_number, 'features');
        if (!rows.some((row) => row.user_id === userId)) rows.push({ issue_id: issue.id, user_id: userId, role, page_number: page });
    }
    await MagazineFeature.destroy({ where: { issue_id: issue.id } });
    if (rows.length) await MagazineFeature.bulkCreate(rows);
    return adminView(issue.id);
};

module.exports = { listAll, adminView, createIssue, updateIssue, deleteIssue, setFeatures };
