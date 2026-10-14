const express = require('express');
const router = express.Router();

const schedulerController = require('./scheduler.controller');
const userAuthMiddleware = require('../../core/auth/userAuth.middleware');
const schedulerMiddleware = require('./scheduler.middleware');


router.post('/availability', [userAuthMiddleware.verifyAuthJWTToken, schedulerMiddleware.validateCreateScheduleBody], schedulerController.createAvailability);
router.post('/', [userAuthMiddleware.verifyAuthJWTToken, schedulerMiddleware.validateFetchAvailabilityForUser], schedulerController.getAvailabilityByProfessionalId);
router.get('/', [userAuthMiddleware.verifyAuthJWTToken], schedulerController.getScheduleRuleAndIntervalByProfessionalToken);
router.put('/availability/:id', [userAuthMiddleware.verifyAuthJWTToken, schedulerMiddleware.isAvailabilityOwner, schedulerMiddleware.validateUpdateScheduleBody], schedulerController.updateAvailability);
router.delete('/availability/:id', [userAuthMiddleware.verifyAuthJWTToken, schedulerMiddleware.isAvailabilityOwner], schedulerController.deleteAvailability);

module.exports = router;