const httpStatus = require('http-status');

const catchAsync = require('../../utils/catchAsync');
const { serviceService } = require('../../services');
const pick = require('../../utils/pick');
const config = require('../../config/config');
const responseWrapper = require('../../config/responseWrapper');

const createService = catchAsync(async (req, res) => {

    const body = pick(req.body, ['name', 'description', 'category_id', 'price', 'duration', 'user']);
    const response = await serviceService.createService(body, req.files);
    return responseWrapper(res, response, 'Service Created.', httpStatus.CREATED);
});

const getAllServiceByToken = catchAsync(async (req, res) => {

    const body = pick(req.body, ['user']);
    const query = pick(req.query, ['sortBy', 'limit', 'page']);
    const params = pick(req.params, []);

    if (!query['limit']) {
        query['limit'] = config.defaultLimit
    };
    if (!query['page']) {
        query['page'] = 1
    };
    if (!query['sortBy'] || query['sortBy'] === '') {
        query['sortBy'] = 'ASC'
    };
    let offset = (query['page'] - 1) * query['limit'];
    query['offset'] = offset;

    const response = await serviceService.getAllServiceByToken(body, query, params);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const getAllServiceByUserId = catchAsync(async (req, res) => {

    const body = pick(req.body, []);
    const query = pick(req.query, ['sortBy', 'limit', 'page']);
    const params = pick(req.params, ['id']);

    if (!query['limit']) {
        query['limit'] = config.defaultLimit
    };
    if (!query['page']) {
        query['page'] = 1
    };
    if (!query['sortBy'] || query['sortBy'] === '') {
        query['sortBy'] = 'ASC'
    };
    let offset = (query['page'] - 1) * query['limit'];
    query['offset'] = offset;

    const response = await serviceService.getAllServiceByUserId(body, query, params);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const getAllServiceNameByUserId = catchAsync(async (req, res) => {

    const response = await serviceService.getAllServiceNameByUserId(req.params.id);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const serviceDetailById = catchAsync(async (req, res) => {

    const body = pick(req.body, []);
    const params = pick(req.params, ['service_id']);

    const response = await serviceService.serviceDetailById(body, params);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const updateService = catchAsync(async (req, res) => {

    const body = pick(req.body, ['service_id', 'name', 'title', 'description', 'category_id', 'price', 'duration', 'overview', 'user']);
    const response = await serviceService.updateService(body, req.files);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const deleteService = catchAsync(async (req, res) => {
    const params = pick(req.params, ['service_id']);
    await serviceService.deleteService(params);
    return responseWrapper(res, '', 'Service Deleted.', httpStatus.OK);
});

const createBooking = catchAsync(async (req, res) => {
    const body = pick(req.body, ['service_id', 'description', 'booking_type', 'user']);
    const response = await serviceService.createBooking(body);
    return responseWrapper(res, response, 'New Booking Done.', httpStatus.CREATED);
});

const getServiceListByCategory = catchAsync(async (req, res) => {
    const response = await serviceService.getServiceListByCategory(req.body);
    return responseWrapper(res, response);
});

const getOtherServiceListByCategory = catchAsync(async (req, res) => {
    const response = await serviceService.getOtherServiceListByCategory(req.body);
    return responseWrapper(res, response);
});


const deleteServiceByAdmin = catchAsync(async (req, res) => {
    await serviceService.deleteServiceByAdmin(req.body);
    return responseWrapper(res, '', 'Service Deleted.', httpStatus.OK);
});
module.exports = {
    createService,
    getAllServiceByToken,
    getAllServiceByUserId,
    getAllServiceNameByUserId,
    serviceDetailById,
    updateService,
    deleteService,
    createBooking,
    getServiceListByCategory,
    getOtherServiceListByCategory,
    deleteServiceByAdmin
};