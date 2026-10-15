const httpStatus = require('../../core/http/status');

const { ContactUs } = require('../../models');
const ApiError = require('../../core/http/ApiError');


const createContactUs = async (reqBody) => {
    const contactUsObj = {
        email: reqBody.email,
        mobile: reqBody.mobile,
        message: reqBody.message,
        name: reqBody.name,
        subject: reqBody.subject
    };

    const contactUsDoc = await ContactUs.create(contactUsObj);
    if (!contactUsDoc) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create new ContactUs');
    };
    return contactUsDoc;
};

const updateContactUs = async (reqBody, id) => {
    const contactUsDoc = await ContactUs.findByPk(id);
    if (!contactUsDoc) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Data not found');
    };

    if (reqBody.email && typeof reqBody.email !== 'undefined' && reqBody.email !== '') contactUsDoc['email'] = reqBody.email;
    if (reqBody.message && reqBody.message !== '' && typeof reqBody.message !== 'undefined') contactUsDoc['message'] = reqBody.message;
    if (reqBody.mobile && reqBody.mobile !== '' && typeof reqBody.mobile !== 'undefined') contactUsDoc['mobile'] = reqBody.mobile;
    if (reqBody.name && reqBody.name !== '' && typeof reqBody.name !== 'undefined') contactUsDoc['name'] = reqBody.name;
    if (reqBody.subject && reqBody.subject !== '' && typeof reqBody.subject !== 'undefined') contactUsDoc['subject'] = reqBody.subject;

    await contactUsDoc.save();
    return contactUsDoc ? contactUsDoc : {};
};

const getAllContactUs = async () => {
    const contactUsDoc = await ContactUs.findAll(
        {
            attributes: ['id', 'email', 'message', 'mobile', 'name', 'subject'],
            where: { is_active: true }
        }
    );
    if (!contactUsDoc) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Data Not Found.');
    };
    return contactUsDoc;
};

const getAllContactUsForAdmin = async (query) => {
    const { limit, sortBy, offset } = query;
    const contactUsDoc = await ContactUs.findAndCountAll(
        {
            attributes: ['id', 'email', 'message', 'mobile', 'name', 'subject'],
            where: { is_active: true },
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['id', sortBy]]
        }
    );
    if (!contactUsDoc) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Data Not Found.');
    };
    return contactUsDoc;
};

const deleteContactUs = async (id) => {
    const contactUsDoc = await ContactUs.findByPk(id);
    if (!contactUsDoc) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Data not found');
    };
    await contactUsDoc.destroy();
};

module.exports = {
    createContactUs,
    getAllContactUs,
    updateContactUs,
    deleteContactUs,
    getAllContactUsForAdmin
};