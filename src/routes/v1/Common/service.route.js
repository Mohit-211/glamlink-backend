const express = require('express');
const router = express.Router();

const { serviceController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

router.post('', [userAuthMiddleware.verifyAuthJWTToken, userAuthMiddleware.validateNewServiceBody], serviceController.createService);
router.get('', [userAuthMiddleware.verifyAuthJWTToken], serviceController.getAllServiceByToken);
router.get('/user/:id', [userAuthMiddleware.verifyAuthJWTToken], serviceController.getAllServiceByUserId);
router.get('/getAllServiceNameByUserId/:id', serviceController.getAllServiceNameByUserId);
router.get('/:service_id', [userAuthMiddleware.verifyAuthJWTToken], serviceController.serviceDetailById);
router.put('', [userAuthMiddleware.verifyAuthJWTToken], serviceController.updateService);
router.delete('/:service_id', [userAuthMiddleware.verifyAuthJWTToken], serviceController.deleteService);

//Bookings
router.post('/bookings', [userAuthMiddleware.verifyAuthJWTToken], serviceController.createBooking);

router.post('/service-list', serviceController.getServiceListByCategory);

router.post('/get-other-service-list',serviceController.getOtherServiceListByCategory);
router.post('/deleteServiceByAdmin',serviceController.deleteServiceByAdmin);

module.exports = router;

