const express = require('express');
const router = express.Router();

const { customerController} = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

router.post('/createCustomer',[userAuthMiddleware.verifyAuthJWTToken],  customerController.createCustomer);
router.get('/getAllCustomer', [userAuthMiddleware.verifyAuthJWTToken], customerController.getAllCustomer);
router.get('/getCustomerById/:id',  customerController.getCustomerById);
router.put('/updateCustomer/:id', [userAuthMiddleware.verifyAuthJWTToken],  customerController.updateCustomer);
router.post('/deleteCustomer', customerController.deleteCustomer);
router.post('/importCustomers',[userAuthMiddleware.verifyAuthJWTToken],  customerController.importCustomers);

router.get('/getAllCustomerName/:id', customerController.getAllCustomerName);

module.exports = router;