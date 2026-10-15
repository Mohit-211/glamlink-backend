const httpStatus = require('../../core/http/status');
const { Role } = require('../../models');
const ApiError = require('../../core/http/ApiError');


const createRole = async (reqBody) => {
    const roleObj = {
        name: reqBody.name,
        abbreviation: reqBody.abbreviation,
        created_at : new Date()
    };
    const roleDoc = await Role.create(roleObj);
    if (!roleDoc) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create new Role');
    }
    return roleDoc ? roleDoc : "";
};

const updateRole = async (reqBody, id) => {
    const roleDoc = await Role.findByPk(id);
    let temp = [];
    if (!roleDoc) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Role not found');
    };
    if (reqBody.name && typeof reqBody.name !== 'undefined' && reqBody.name !== '') {
        roleDoc['name'] = reqBody.name;
        temp.push(1)
    };
    if (reqBody.abbreviation && typeof reqBody.abbreviation !== 'undefined' && reqBody.abbreviation !== '') {
        roleDoc['abbreviation'] = reqBody.abbreviation
        temp.push(2)
    };
    if (temp.length > 0 && temp.length < 2) throw new ApiError(httpStatus.NOT_FOUND, 'Name and Abbreviation both needed.');
    await roleDoc.save();
    return roleDoc ? roleDoc : {};
};

const findRoleById = async (id) => {
    const isRoleIdValid = await Role.findByPk(id);
    return isRoleIdValid
};

const getAllRoles = async (query) => {
    const { limit, sortBy, offset } = query;
    const roleDoc = await Role.findAndCountAll({ 
        where: { is_active: 1 } ,
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['id', sortBy]]
    });
    if (!roleDoc) {
        throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to create new Role.');
    };
    return roleDoc;
};

const deleteRole = async (id) => {
    const roleDoc = await Role.findByPk(id);
    if (!roleDoc) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Role not found');
    }
    await roleDoc.destroy();
};

module.exports = {
    findRoleById,
    createRole,
    getAllRoles,
    deleteRole,
    updateRole
};