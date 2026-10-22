// A professional's or brand's own products (/my/products; Mohit, Oct 23): they show as soon as they are saved, and
// admins can still edit, unpublish or delete them (the admin product calls). A brand's products are its own make.
const httpStatus = require('../../core/http/status');
const ApiError = require('../../core/http/ApiError');
const { paging } = require('../../core/http/paging');
const { isUploadedImage, removeUploadedFile } = require('../../core/http/uploadedFiles');
const { Shop } = require('../../models');
const { withLinks, PRODUCT_CARD } = require('./discover.service');

const refuse = (field, message) => ApiError.withCode(httpStatus.BAD_REQUEST, message, 'INVALID_PRODUCT', { field });
const empty = (value) => value === null || value === undefined || (typeof value === 'string' && !value.trim());

const text = (value, field, max) => {
    if (empty(value)) return null;
    const out = String(value).trim();
    if (out.length > max) throw refuse(field, `${field} is at most ${max} characters.`);
    return out;
};

const TEXTS = { title: 255, short_description: 1000, description: 5000, category: 100, brand: 100 };

// The fields sent (form fields or JSON). The cover is a file (`images`, one) or "" to remove it.
const productFields = (body, files, { creating = false } = {}) => {
    const fields = {};
    for (const [field, max] of Object.entries(TEXTS)) if (body[field] !== undefined || creating) fields[field] = text(body[field], field, max);
    if (creating && !fields.title) throw refuse('title', 'title is required.');
    if (body.title !== undefined && !fields.title) throw refuse('title', 'title is required.');
    if (body.price !== undefined) {
        if (empty(body.price)) fields.price = null;
        else {
            // Dollars with at most two decimals, read from the text (19.99 * 100 is not 1999 in floating point).
            const price = String(body.price).trim();
            if (!/^\d{1,6}(\.\d{1,2})?$/.test(price) || Number(price) > 100000) throw refuse('price', 'price is an amount in dollars (12.50).');
            fields.price = price;
        }
    }
    if (body.link !== undefined) {
        const link = text(body.link, 'link', 1000);
        if (link && !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(link)) throw refuse('link', 'link is a web link (https://...).');
        fields.link = link;
    }
    if (body.status !== undefined) {
        if (!['draft', 'published'].includes(body.status)) throw refuse('status', 'status is draft or published.');
        fields.status = body.status;
    }
    if (files?.images?.[0]) fields.cover_image = files.images[0].filename;
    else if (body.cover_image !== undefined) {
        if (body.cover_image && !isUploadedImage(body.cover_image)) throw refuse('cover_image', 'cover_image is an image uploaded to the API.');
        fields.cover_image = body.cover_image || null;
    }
    return fields;
};

const ATTRIBUTES = [...PRODUCT_CARD, 'description', 'status'];

const view = async (product) => (await withLinks([await Shop.findByPk(product.id, { attributes: ATTRIBUTES })]))[0];

const own = async (user, id) => {
    const product = await Shop.findOne({ where: { id, owner_id: user.id, is_active: true } });
    if (!product) throw ApiError.withCode(httpStatus.NOT_FOUND, 'Product not found.', 'NOT_FOUND');
    return product;
};

// The owner's products, drafts too, newest first.
const listMine = async (user, query = {}) => {
    const { limit, offset } = paging(query);
    const { count, rows } = await Shop.findAndCountAll({ attributes: ATTRIBUTES, where: { owner_id: user.id, is_active: true }, order: [['id', 'DESC']], limit, offset });
    return { count, rows: await withLinks(rows) };
};

const createMine = async (user, body, files) => {
    const product = await Shop.create({
        ...productFields(body, files, { creating: true }),
        status: body.status === 'draft' ? 'draft' : 'published',
        owner_id: user.id,
        brand_id: user.professional_type === 'brand' ? user.id : null,
    });
    return view(product);
};

const updateMine = async (user, id, body, files) => {
    const product = await own(user, id);
    const fields = productFields(body, files);
    const oldCover = product.cover_image;
    await product.update(fields);
    if (fields.cover_image !== undefined && oldCover && oldCover !== fields.cover_image) removeUploadedFile(oldCover);
    return view(product);
};

const deleteMine = async (user, id) => {
    const product = await own(user, id);
    await product.update({ is_active: false });
    await product.destroy();
    return { deleted: true };
};

module.exports = { listMine, createMine, updateMine, deleteMine };
