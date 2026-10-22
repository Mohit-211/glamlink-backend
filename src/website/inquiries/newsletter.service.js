// Newsletter sign-ups from the website's forms (the popup, the footer, the podcast's "Notify me"): one row per email.
// Signing up again keeps the first source and fills in a name the first sign-up lacked; the answer is the same
// either way, so the form never tells whether an email was already on the list. Mailchimp comes later.
const { Op } = require('sequelize');
const { NewsletterSubscriber } = require('../../models');
const { paging, idList } = require('../../core/http/paging');
const { containing } = require('../../core/utils/like');
const { toCsv } = require('../../core/utils/csv');
const { refuse, text, email } = require('./formInput');

const subscribe = async (body, ipAddress) => {
    const address = email(body);
    const firstName = text(body, 'first_name', { max: 100, label: 'First name' });
    const lastName = text(body, 'last_name', { max: 100, label: 'Last name' });
    const source = text(body, 'source', { max: 40, label: 'Source' });
    if (source && !/^[a-z0-9-]+$/.test(source)) throw refuse('source', 'source is lower-case letters, digits and dashes (popup, footer, podcast).');

    const [subscriber, created] = await NewsletterSubscriber.findOrCreate({
        where: { email: address },
        defaults: { email: address, first_name: firstName, last_name: lastName, source, ip_address: ipAddress || null },
    });
    if (!created) {
        const names = { ...(firstName && !subscriber.first_name && { first_name: firstName }), ...(lastName && !subscriber.last_name && { last_name: lastName }) };
        if (Object.keys(names).length) await subscriber.update(names);
    }
    return { subscribed: true };
};

const filters = (query) => {
    const where = {};
    const search = String(query.search ?? '').trim();
    if (search) {
        const term = containing(search);
        where[Op.or] = ['email', 'first_name', 'last_name'].map((column) => ({ [column]: { [Op.like]: term } }));
    }
    if (query.source) where.source = String(query.source);
    return where;
};

const ATTRIBUTES = ['id', 'email', 'first_name', 'last_name', 'source', 'created_at', 'updated_at'];

// Newest first; search (email or name) and source narrow it.
const listSubscribers = (query = {}) => {
    const { limit, offset } = paging(query, { defaultLimit: 50 });
    return NewsletterSubscriber.findAndCountAll({ attributes: ATTRIBUTES, where: filters(query), order: [['created_at', 'DESC'], ['id', 'DESC']], limit, offset });
};

// Every subscriber matching the same filters, as CSV.
const exportSubscribers = async (query = {}) => {
    const rows = await NewsletterSubscriber.findAll({ attributes: ATTRIBUTES, where: filters(query), order: [['created_at', 'DESC'], ['id', 'DESC']], raw: true });
    return toCsv([
        { key: 'email', label: 'Email' },
        { key: 'first_name', label: 'First name' },
        { key: 'last_name', label: 'Last name' },
        { key: 'source', label: 'Source' },
        { key: 'created_at', label: 'Signed up' },
    ], rows);
};

// Removes the subscribers (their email is gone from the list).
const deleteSubscribers = async (body) => {
    const ids = idList(body.ids);
    if (!ids.length) throw refuse('ids', 'Send the ids to delete.');
    const deleted = await NewsletterSubscriber.destroy({ where: { id: ids } });
    return { deleted };
};

module.exports = { subscribe, listSubscribers, exportSubscribers, deleteSubscribers };
