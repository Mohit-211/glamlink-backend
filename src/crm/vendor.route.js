const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../shared/admin');

const vendorController = require('./vendor.controller');
const { authenticate } = require('../shared/identity');

router.post('/createVendor', [authenticate], vendorController.createVendor);
router.get('/getAllVendor', [authenticate], vendorController.getAllVendor);
router.get('/getVendorById/:id', requireAdmin, vendorController.getVendorById);
router.get('/getVendorName', [authenticate],vendorController.getVendorName);
router.put('/updateVendor/:id', requireAdmin, vendorController.updateVendor);
router.post('/delete', requireAdmin, vendorController.deleteVendor);


module.exports = router;

