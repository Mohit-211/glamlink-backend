const httpStatus = require('http-status');
const pick = require('../../utils/pick');
const catchAsync = require('../../utils/catchAsync');
const { appointmentService } = require('../../services/Common');
const responseWrapper = require('../../config/responseWrapper');

const getAllAppointment = catchAsync(async (req, res) => {
    const body = pick(req.body, ['text', 'user']);
    const header = pick(req.headers, ['timezone']);
    const query = pick(req.query, ['timeStatus']);
    const response = await appointmentService.getAllAppointment(body, header, query);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const createAppointment = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'notes', 'counselor_id', 'start_time', 'end_time', 'service_id', 'date', 'availability_id', 'availabilityDoc', 'start_time_local', 'end_time_local']);
    const header = pick(req.headers, ['timezone']);
    const response = await appointmentService.createAppointment(body, header);
    return responseWrapper(res, response, 'Appointment Schedule Successfully.', httpStatus.OK);
});

const cancleAppointment = catchAsync(async (req, res) => {
    const body = pick(req.body, [ 'user', 'reason']);
    const params = pick(req.params, ['appointmentId']);
    const response = await appointmentService.cancleAppointment(body, params);
    return responseWrapper(res, response, 'Appointment Canceled.', httpStatus.OK);
});

const appointmentDetail = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user']);
    const params = pick(req.params, ['appointmentId']);
    const header = pick(req.headers, ['timezone']);
    const response = await appointmentService.appointmentDetail(body, header, params);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const acceptAppointment = catchAsync(async (req, res) => {
    const body = pick(req.body, ['user', 'appointment_id']);
    const header = pick(req.headers, ['timezone']);
    const response = await appointmentService.acceptAppointment(body, header);
    return responseWrapper(res, response, 'Appointment Scheduled Successfully.', httpStatus.OK);
});


// crm
const getAllAppointmentForProfessional = catchAsync(async (req, res) => {
    const response = await appointmentService.getAllAppointmentForProfessional(req.body);
    return responseWrapper(res, response, '', httpStatus.OK);
});

const createAppointmentForEmployee = catchAsync(async (req, res) => {
    const header = pick(req.headers, ['timezone']);
    const response = await appointmentService.createAppointmentForEmployee(req.body, header);
    return responseWrapper(res, response, 'Appointment Schedule Successfully.', httpStatus.OK);
});


const deleteAppointment = catchAsync(async (req, res) => {
    const response = await appointmentService.deleteAppointment(req.body);
    return responseWrapper(res, response, 'Appointment Schedule Successfully.', httpStatus.OK);
});


module.exports = {
    getAllAppointment,
    createAppointment,
    cancleAppointment,
    appointmentDetail,
    acceptAppointment,
    getAllAppointmentForProfessional,
    createAppointmentForEmployee,
    deleteAppointment
}