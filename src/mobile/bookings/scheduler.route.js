const express = require('express');
const router = express.Router();

const schedulerController = require('./scheduler.controller');
const { requireProfessional } = require('../../shared/identity/authenticate');
const schedulerMiddleware = require('./scheduler.validation');


router.post('/availability', [requireProfessional, schedulerMiddleware.validateCreateScheduleBody], schedulerController.createAvailability);
router.post('/', [requireProfessional, schedulerMiddleware.validateFetchAvailabilityForUser], schedulerController.getAvailabilityByProfessionalId);
router.get('/', [requireProfessional], schedulerController.getScheduleRuleAndIntervalByProfessionalToken);
router.put('/availability/:id', [requireProfessional, schedulerMiddleware.isAvailabilityOwner, schedulerMiddleware.validateUpdateScheduleBody], schedulerController.updateAvailability);
router.delete('/availability/:id', [requireProfessional, schedulerMiddleware.isAvailabilityOwner], schedulerController.deleteAvailability);

module.exports = router;