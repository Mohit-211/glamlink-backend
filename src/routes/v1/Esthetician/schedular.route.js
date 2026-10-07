const express = require('express');
const router = express.Router();

const { schedularController } = require('../../../controllers');
const { userAuthMiddleware, schedularMiddleware } = require('../../../middlewares');


// router.post('/availability', [userAuthMiddleware.verifyAuthJWTToken, schedularMiddleware.validateCreateScheduleBody], schedularController.createAvailability);
router.post('/availability', [userAuthMiddleware.verifyAuthJWTToken, schedularMiddleware.validateCreateScheduleBody], schedularController.createAvailability);
router.post('/', [userAuthMiddleware.verifyAuthJWTToken, schedularMiddleware.validateFetchAvailabilityForUser], schedularController.getAvailabilityByCounselorId);
router.get('/', [userAuthMiddleware.verifyAuthJWTToken], schedularController.getSchedulRuleAndIntervalByCounselorToken);
router.put('/availability/:id', [userAuthMiddleware.verifyAuthJWTToken, schedularMiddleware.isAvailabilityOwner, schedularMiddleware.validateUpdateScheduleBody], schedularController.updateAvailability);
router.delete('/availability/:id', [userAuthMiddleware.verifyAuthJWTToken, schedularMiddleware.isAvailabilityOwner], schedularController.deleteAvailability);

module.exports = router;