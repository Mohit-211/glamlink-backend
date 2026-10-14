const express = require('express');
const router = express.Router();

const appointmentController = require('../../../controllers/Common/appointment.controller');
const userAuthMiddleware = require('../../../middlewares/userAuth.middleware');
const apointmentMiddleware = require('../../../middlewares/apointment.middleware');

router.post('/', [userAuthMiddleware.verifyAuthJWTToken, apointmentMiddleware.validateCreateApointmentBody], appointmentController.createAppointment);
router.get('/', [userAuthMiddleware.verifyAuthJWTToken], appointmentController.getAllAppointment);
router.get('/:appointmentId', [userAuthMiddleware.verifyAuthJWTToken], appointmentController.appointmentDetail);

router.put('/cancel/:appointmentId', [userAuthMiddleware.verifyAuthJWTToken], appointmentController.cancleAppointment);
router.post('/accept', [userAuthMiddleware.verifyAuthJWTToken], appointmentController.acceptAppointment);


// crm
router.post('/getAllAppointmentForProfessional', [userAuthMiddleware.verifyAuthJWTToken], appointmentController.getAllAppointmentForProfessional);
router.post('/createAppointmentForEmployee', [userAuthMiddleware.verifyAuthJWTToken], appointmentController.createAppointmentForEmployee);
router.post('/deleteAppointment', [userAuthMiddleware.verifyAuthJWTToken], appointmentController.deleteAppointment);

module.exports = router;
