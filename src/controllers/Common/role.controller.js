const httpStatus = require('http-status');

const catchAsync = require('../../utils/catchAsync');
const { roleService } = require('../../services/Common');
const responseWrapper = require('../../config/responseWrapper');
const config = require('../../config/config');
const pick = require('../../utils/pick');

const createRole = catchAsync(async (req, res) => {

    const roleDoc = await roleService.createRole(req.body);
    return responseWrapper(res, roleDoc, 'New Role Created Successfully.', httpStatus.CREATED);
});

const updateRole = catchAsync(async (req, res) => {

    const roleDoc = await roleService.updateRole(req.body, req.params.id);
    return responseWrapper(res, roleDoc, 'Role Updated Successfully', httpStatus.OK);
});

const getAllRoles = catchAsync(async (req, res) => {
    const query = pick(req.query, ['limit', 'sortBy', 'offset', 'page' ]);
    if (!query['limit']) {
        query['limit'] = config.defaultLimit
    }
    if (!query['page']) {
        query['page'] = 1
    }
    if (!query['sortBy'] || query['sortBy'] === '') {
        query['sortBy'] = 'ASC'
    }
    let offset = (query['page'] - 1) * query['limit'];
    query['offset'] = offset;
    const roles = await roleService.getAllRoles(query);
    return responseWrapper(res, roles, '', httpStatus.OK);
});

const findRoleById = catchAsync(async (req, res) => {

    const roleDoc = await roleService.findRoleById(req.params.id);
    return responseWrapper(res, roleDoc, '');
});

const deleteRole = catchAsync(async (req, res) => {

    await roleService.deleteRole(req.params.id);
    return responseWrapper(res, '', 'Delete Successfull.');
});

module.exports = {
    createRole,
    getAllRoles,
    findRoleById,
    deleteRole,
    updateRole
};