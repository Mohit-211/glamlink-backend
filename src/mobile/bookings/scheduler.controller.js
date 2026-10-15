
const catchAsync = require('../../core/http/catchAsync');
const schedulerService = require('./scheduler.service');
const pick = require('../../core/utils/pick');
const responseWrapper = require('../../core/http/responseWrapper');

const createAvailability = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'timezone', 'slot_duration_in_minuites', 'start_time', 'end_time', 'day', 'maximum_available_seats', 'start_time_local', 'end_time_local',]);
    const response = await schedulerService.createAvailability(body);
    return responseWrapper(res, response, '');
});

const getScheduleRuleAndIntervalByProfessionalToken = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const header = pick(req.headers, ['timezone']);
    const response = await schedulerService.getScheduleRuleAndIntervalByProfessionalToken(body, header);
    return responseWrapper(res, response, '');
});

const getAvailabilityByProfessionalId = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'dates', 'professional_id', 'professionalDoc']);
    const header = pick(req.headers, ['timezone']);
    const response = await schedulerService.getAvailabilityByProfessionalId(body, header);
    return responseWrapper(res, response, '');
});

const updateAvailability = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'availabilityDoc', 'start_time', 'end_time', 'maximum_available_seats', 'start_time_local', 'end_time_local']);
    const params = pick(req.params, ['id']);
    const response = await schedulerService.updateAvailability(body, params);
    return responseWrapper(res, response, '');
});
const deleteAvailability = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'availabilityDoc']);
    const params = pick(req.params, ['id']);
    const response = await schedulerService.deleteAvailability(body, params);
    return responseWrapper(res, response, '');
});


module.exports = {
    createAvailability,
    getScheduleRuleAndIntervalByProfessionalToken,
    getAvailabilityByProfessionalId,
    updateAvailability,
    deleteAvailability,
};