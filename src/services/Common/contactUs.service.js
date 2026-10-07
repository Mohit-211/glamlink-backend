const httpStatus = require('http-status');
const slugify = require('slugify');

const { ContactUs } = require('../../models');
const ApiError = require('../../utils/ApiError');


const createContactUs = async (reqBody) => {
    try {
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

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const updateContactUs = async (reqBody, id) => {
    try {
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

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const getAllContactUs = async () => {
    try {
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
    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const getAllContactUsForAdmin = async (query) => {
    try {
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
    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const deleteContactUs = async (id) => {
    try {
        const contactUsDoc = await ContactUs.findByPk(id);
        if (!contactUsDoc) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Data not found');
        };
        await contactUsDoc.destroy();

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

module.exports = {
    createContactUs,
    getAllContactUs,
    updateContactUs,
    deleteContactUs,
    getAllContactUsForAdmin
};