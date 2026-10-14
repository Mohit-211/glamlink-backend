const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../../middlewares/access.middleware');

const vendorController = require('../../../controllers/Common/vendor.controller');
const userAuthMiddleware = require('../../../middlewares/userAuth.middleware');

router.post('/createVendor', [userAuthMiddleware.verifyAuthJWTToken], vendorController.createVendor);
router.get('/getAllVendor', [userAuthMiddleware.verifyAuthJWTToken], vendorController.getAllVendor);
router.get('/getVendorById/:id', requireAdmin, vendorController.getVendorById);
router.get('/getVendorName', [userAuthMiddleware.verifyAuthJWTToken],vendorController.getVendorName);
router.put('/updateVendor/:id', requireAdmin, vendorController.updateVendor);
router.post('/delete', requireAdmin, vendorController.deleteVendor);


module.exports = router;

