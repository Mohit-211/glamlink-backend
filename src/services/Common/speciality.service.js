
const httpStatus = require('http-status');
const moment = require('moment')
const { Speciality } = require('../../models');
const ApiError = require('../../utils/ApiError');


const createSpeciality = async (reqBody) => {

    try {
        const specialityObj = {
            name: reqBody.name,
            created_at : moment()
        };
        const specialityDoc = await Speciality.create(specialityObj);
        if (!specialityDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create new Speciality');
        };
        return specialityDoc ;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};


const getAllSpecialities = async (query) => {

    try {
        const { limit, sortBy, offset } = query;
        const specialityDoc = await Speciality.findAndCountAll(
            {
                where: { is_active: true } ,
                limit: parseInt(limit),
                offset: parseInt(offset),
                order: [['id', sortBy]]
            }
        );
        if (!specialityDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to get all Speciality');
        }
        return specialityDoc;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }


};

const findSpecialityById = async (id) => {

    try {
        const specialityDoc = await Speciality.findOne(
            {
                where: { id: id, is_active: true }
            }
        );
        return specialityDoc ? specialityDoc : "No Specialiy Found";

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }

};

const updateSpeciality = async (reqBody, id) => {

    try {
        const specialityDoc = await Speciality.findByPk(id);

        if (!specialityDoc) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Speciality not found');
        }
        if (reqBody.name && typeof reqBody.name !== 'undefined' && reqBody.name !== '') {
            specialityDoc['name'] = reqBody.name;
        };

        await specialityDoc.save();
        return specialityDoc ? specialityDoc : {};

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const deleteSpeciality = async (id) => {

    try {
        const speciality = await Speciality.findByPk(id);
        if (!speciality) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Speciality not found');
        }
        await speciality.destroy();

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

module.exports = {
    findSpecialityById,
    createSpeciality,
    getAllSpecialities,
    updateSpeciality,
    deleteSpeciality
};