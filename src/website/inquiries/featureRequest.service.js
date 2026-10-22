// "Apply for Feature" on the website: a professional asks to be featured. Every field of the form is required;
// support@glamlink.net hears of each request.
const { Op } = require('sequelize');
const { FeatureRequest } = require('../../models');
const { paging, idList } = require('../../core/http/paging');
const { containing } = require('../../core/utils/like');
const { sendFeatureRequestEmail } = require('../../integrations/mailer/email.service');
const { refuse, text, email, phone } = require('./formInput');

const createFeatureRequest = async (body) => {
    const request = {
        name: text(body, 'name', { required: true, max: 100, label: 'Name' }),
        specialty: text(body, 'specialty', { required: true, max: 100, label: 'Specialty' }),
        email: email(body),
        phone: phone(body, 'phone', { required: true }),
        city: text(body, 'city', { required: true, max: 100, label: 'City' }),
        interest: text(body, 'interest', { required: true, max: 100, label: 'What you are interested in' }),
    };
    const row = await FeatureRequest.create(request);
    await sendFeatureRequestEmail(request);
    return { id: row.id };
};

// Newest first; search (name, email, specialty or city) and interest narrow it.
const listFeatureRequests = (query = {}) => {
    const { limit, offset } = paging(query, { defaultLimit: 50 });
    const where = {};
    const search = String(query.search ?? '').trim();
    if (search) {
        const term = containing(search);
        where[Op.or] = ['name', 'email', 'specialty', 'city'].map((column) => ({ [column]: { [Op.like]: term } }));
    }
    if (query.interest) where.interest = String(query.interest);
    return FeatureRequest.findAndCountAll({ where, order: [['created_at', 'DESC'], ['id', 'DESC']], limit, offset });
};

const deleteFeatureRequests = async (body) => {
    const ids = idList(body.ids);
    if (!ids.length) throw refuse('ids', 'Send the ids to delete.');
    const deleted = await FeatureRequest.destroy({ where: { id: ids } });
    return { deleted };
};

module.exports = { createFeatureRequest, listFeatureRequests, deleteFeatureRequests };
