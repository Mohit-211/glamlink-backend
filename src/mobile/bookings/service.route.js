const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin/access.middleware');

const serviceController = require('./service.controller');
const { authenticate, optionalAuth } = require('../../shared/identity/authenticate');
const serviceValidation = require('./service.validation');

router.post('', [authenticate, serviceValidation.validateNewServiceBody], serviceController.createService);
router.get('', [authenticate], serviceController.getAllServiceByToken);
router.get('/user/:id', [optionalAuth], serviceController.getAllServiceByUserId);
router.get('/getAllServiceNameByUserId/:id', serviceController.getAllServiceNameByUserId);
router.get('/:service_id', [optionalAuth], serviceController.serviceDetailById);
router.put('', [authenticate], serviceController.updateService);
router.delete('/:service_id', [authenticate], serviceController.deleteService);

//Bookings
router.post('/bookings', [authenticate], serviceController.createBooking);

router.post('/service-list', serviceController.getServiceListByCategory);

router.post('/get-other-service-list',serviceController.getOtherServiceListByCategory);
router.post('/deleteServiceByAdmin', requireAdmin,serviceController.deleteServiceByAdmin);

module.exports = router;

