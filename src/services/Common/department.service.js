const httpStatus = require('http-status');
const moment = require('moment')

const { Department } = require('../../models');
const ApiError = require('../../utils/ApiError');

const createDepartment = async (reqBody) => {
    try {
        const departmentObj = {
            name: reqBody.name, 
            created_at : moment()
        };
        const departmentDoc = await Department.create(departmentObj);
        if (!departmentDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create new Department');
        }
        return departmentDoc;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};



const updateDepartment = async (reqBody, id) => {
    try {
        const departmentDoc = await Department.findByPk(id);

        if (!departmentDoc) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Department not found');
        }
        if (reqBody.name && typeof reqBody.name !== 'undefined' && reqBody.name !== '') {
            departmentDoc['name'] = reqBody.name;
        };

        await departmentDoc.save();
        return departmentDoc;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const getAllDeparments = async (query) => {
    try {
        const { limit, sortBy, offset } = query;
        const departmentDoc = await Department.findAndCountAll({ 
            where: { is_active: 1 } ,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['id', sortBy]]
        });
        if (!departmentDoc) {
            throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create new Department');
        }
        return departmentDoc;

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const findDepartmentById = async (id) => {
    try {
        const departmentDoc = await Department.findByPk(id);
        return departmentDoc ? departmentDoc : {};

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

const deleteDepartment = async (id) => {
    try {
        const departmentDoc = await Department.findByPk(Number(id));
        if (!departmentDoc) {
            throw new ApiError(httpStatus.NOT_FOUND, 'Department not found');
        }
        return await departmentDoc.destroy();

    } catch (error) {
        throw new ApiError(error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR, error.message);
    }
};

module.exports = {
    getAllDeparments,
    createDepartment,
    updateDepartment,
    findDepartmentById,
    deleteDepartment
};