const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../core/auth/access.middleware');

const customerController = require('./customer.controller');
const userAuthMiddleware = require('../../core/auth/userAuth.middleware');

router.post('/createCustomer',[userAuthMiddleware.verifyAuthJWTToken],  customerController.createCustomer);
router.get('/getAllCustomer', [userAuthMiddleware.verifyAuthJWTToken], customerController.getAllCustomer);
router.get('/getCustomerById/:id', requireAdmin,  customerController.getCustomerById);
router.put('/updateCustomer/:id', [userAuthMiddleware.verifyAuthJWTToken],  customerController.updateCustomer);
router.post('/deleteCustomer', requireAdmin, customerController.deleteCustomer);
router.post('/importCustomers',[userAuthMiddleware.verifyAuthJWTToken],  customerController.importCustomers);

router.get('/getAllCustomerName/:id', requireAdmin, customerController.getAllCustomerName);

module.exports = router;