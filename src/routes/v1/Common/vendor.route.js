const express = require('express');
const router = express.Router();

const { vendorController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

router.post('/createVendor', [userAuthMiddleware.verifyAuthJWTToken], vendorController.createVendor);
router.get('/getAllVendor', [userAuthMiddleware.verifyAuthJWTToken], vendorController.getAllVendor);
router.get('/getVendorById/:id', vendorController.getVendorById);
router.get('/getVendorName', [userAuthMiddleware.verifyAuthJWTToken],vendorController.getVendorName);
router.put('/updateVendor/:id', vendorController.updateVendor);
router.post('/delete', vendorController.deleteVendor);


module.exports = router;

