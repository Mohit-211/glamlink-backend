const httpStatus = require('http-status');
const config = require('../../core/config/config');
const pick = require('../../core/utils/pick');
const catchAsync = require('../../core/http/catchAsync');
const departmentService = require('./department.service');
const responseWrapper = require('../../core/http/responseWrapper');

const getAllDeparments = catchAsync(async (req, res) => {
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
    const departments = await departmentService.getAllDeparments(query);
    return responseWrapper(res, departments, '');
});

const createDepartment = catchAsync(async (req, res) => {

    const department = await departmentService.createDepartment(req.body);
    return responseWrapper(res, department, 'New department Created Successfully', httpStatus.CREATED);
});

const updateDepartment = catchAsync(async (req, res) => {

    const departmentDoc = await departmentService.updateDepartment(req.body, req.params.id);
    return responseWrapper(res, departmentDoc, 'Department Update Successfully');
});

const findDepartmentById = catchAsync(async (req, res) => {

    const departmentDoc = await departmentService.findDepartmentById(req.params.id);
    return responseWrapper(res, departmentDoc, '');
});

const deleteDepartment = catchAsync(async (req, res) => {

    await departmentService.deleteDepartment(req.params.id);
    return responseWrapper(res, '', 'Delete Successfull.', httpStatus.OK);
});

module.exports = {
    getAllDeparments,
    createDepartment,
    updateDepartment,
    findDepartmentById,
    deleteDepartment
};