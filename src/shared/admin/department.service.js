const httpStatus = require('../../core/http/status');

const { Department } = require('../../models');
const ApiError = require('../../core/http/ApiError');

const createDepartment = async (reqBody) => {
    const departmentObj = {
        name: reqBody.name, 
        created_at : new Date()
    };
    const departmentDoc = await Department.create(departmentObj);
    if (!departmentDoc) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create new Department');
    }
    return departmentDoc;
};



const updateDepartment = async (reqBody, id) => {
    const departmentDoc = await Department.findByPk(id);

    if (!departmentDoc) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Department not found');
    }
    if (reqBody.name && typeof reqBody.name !== 'undefined' && reqBody.name !== '') {
        departmentDoc['name'] = reqBody.name;
    };

    await departmentDoc.save();
    return departmentDoc;
};

const getAllDeparments = async (query) => {
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
};

const findDepartmentById = async (id) => {
    const departmentDoc = await Department.findByPk(id);
    return departmentDoc ? departmentDoc : {};
};

const deleteDepartment = async (id) => {
    const departmentDoc = await Department.findByPk(Number(id));
    if (!departmentDoc) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Department not found');
    }
    return await departmentDoc.destroy();
};

module.exports = {
    getAllDeparments,
    createDepartment,
    updateDepartment,
    findDepartmentById,
    deleteDepartment
};