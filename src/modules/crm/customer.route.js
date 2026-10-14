const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../core/auth/access.middleware');

const customerController = require('./customer.controller');
const { authenticate } = require('../../core/auth/authenticate');

router.post('/createCustomer',[authenticate],  customerController.createCustomer);
router.get('/getAllCustomer', [authenticate], customerController.getAllCustomer);
router.get('/getCustomerById/:id', requireAdmin,  customerController.getCustomerById);
router.put('/updateCustomer/:id', [authenticate],  customerController.updateCustomer);
router.post('/deleteCustomer', requireAdmin, customerController.deleteCustomer);
router.post('/importCustomers',[authenticate],  customerController.importCustomers);

router.get('/getAllCustomerName/:id', requireAdmin, customerController.getAllCustomerName);

module.exports = router;