const express = require('express');
const router = express.Router();

const appointmentController = require('./appointment.controller');
const { authenticate } = require('../../shared/identity');
const appointmentMiddleware = require('./appointment.validation');

router.post('/', [authenticate, appointmentMiddleware.validateCreateAppointmentBody], appointmentController.createAppointment);
router.get('/', [authenticate], appointmentController.getAllAppointment);
router.get('/:appointmentId', [authenticate], appointmentController.appointmentDetail);

router.put('/cancel/:appointmentId', [authenticate], appointmentController.cancleAppointment);
router.post('/accept', [authenticate], appointmentController.acceptAppointment);


// crm
router.post('/getAllAppointmentForProfessional', [authenticate], appointmentController.getAllAppointmentForProfessional);
router.post('/createAppointmentForEmployee', [authenticate], appointmentController.createAppointmentForEmployee);
router.post('/deleteAppointment', [authenticate], appointmentController.deleteAppointment);

module.exports = router;
