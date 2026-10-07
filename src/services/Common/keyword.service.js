
const httpStatus = require('http-status');
const moment = require('moment')
const { Keyword } = require('../../models');
const ApiError = require('../../utils/ApiError');


const createKeyword = async (reqBody) => {

    try {
        const keywordObj = {
            title: reqBody.title,
            description: reqBody.description,
            created_at : moment()
        };

        const keywordDoc = await Keyword.create(keywordObj);
        if (!keywordDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create new Keyword');
        };
        return keywordDoc ;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};


const getAllCategories = async (query) => {

    try {
        const { limit, sortBy, offset } = query;
        const keywordDoc = await Keyword.findAndCountAll(
            {
                where: { is_active: true } ,
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['id', sortBy]]
            }
        );
        if (!keywordDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get all Keyword');
        }
        return keywordDoc;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }


};

const findKeywordById = async (id) => {

    try {
        const keywordDoc = await Keyword.findOne(
            {
                where: { id: id, is_active: true }
            }
        );
        return keywordDoc ? keywordDoc : "No Keyword Found";

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }

};

const updateKeyword = async (reqBody, id) => {

    try {
        const keywordDoc = await Keyword.findByPk(id);

        if (!keywordDoc) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Keyword not found');
        }
        if (reqBody.title && typeof reqBody.title !== 'undefined' && reqBody.title !== '') {
            keywordDoc['title'] = reqBody.title;
        };
        if (reqBody.description && typeof reqBody.description !== 'undefined' && reqBody.description !== '') {
            keywordDoc['description'] = reqBody.description;
        };

        await keywordDoc.save();
        return keywordDoc ? keywordDoc : {};

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const deleteKeyword = async (id) => {

    try {
        const keyword = await Keyword.findByPk(id);
        if (!keyword) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Keyword not found');
        }
        await keyword.destroy();

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

module.exports = {
    findKeywordById,
    createKeyword,
    getAllCategories,
    updateKeyword,
    deleteKeyword
};