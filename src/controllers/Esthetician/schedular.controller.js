const httpStatus = require('http-status');

const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const { schedularService } = require('../../services');
const pick = require('../../utils/pick');
const responseWrapper = require('../../config/responseWrapper');

// const createAvailability = catchAsync(async (req, res) => {
//     const body = pick(req.body, ['user', 'timezone', 'slot_duration_in_minuites', 'start_time', 'end_time', 'day', 'date', 'type', 'no_of_months', 'maximum_available_seats']);
//     const response = await schedularService.createAvailability(body);
//     return responseWrapper(res, response, '');
// });
const createAvailability = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'timezone', 'slot_duration_in_minuites', 'start_time', 'end_time', 'day', 'maximum_available_seats', 'start_time_local', 'end_time_local',]);
    const response = await schedularService.createAvailability(body);''
    return responseWrapper(res, response, '');
});

const getSchedulRuleAndIntervalByCounselorToken = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const header = pick(req.headers, ['timezone']);
    const response = await schedularService.getSchedulRuleAndIntervalByCounselorToken(body, header);
    return responseWrapper(res, response, '');
});

const getAvailabilityByCounselorId = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'dates', 'counselor_id', 'counselorDoc']);
    const header = pick(req.headers, ['timezone']);
    const response = await schedularService.getAvailabilityByCounselorId(body, header);
    return responseWrapper(res, response, '');
});

const updateAvailability = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'availabilityDoc', 'start_time', 'end_time', 'maximum_available_seats', 'start_time_local', 'end_time_local']);
    const params = pick(req.params, ['id']);
    const response = await schedularService.updateAvailability(body, params);
    return responseWrapper(res, response, '');
});
const deleteAvailability = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'availabilityDoc']);
    const params = pick(req.params, ['id']);
    const response = await schedularService.deleteAvailability(body, params);
    return responseWrapper(res, response, '');
});


module.exports = {
    createAvailability,
    getSchedulRuleAndIntervalByCounselorToken,
    getAvailabilityByCounselorId,
    updateAvailability,
    deleteAvailability,
};