const express = require('express');
const router = express.Router();

const priceController = require('../../../controllers/Common/price.controller');
const adminAuthMiddleware = require('../../../middlewares/adminAuth.middleware');

router.post('/' , [ adminAuthMiddleware.validateJWTtoken] ,priceController.createPrice);
router.put('/:priceId' , [ adminAuthMiddleware.validateJWTtoken], priceController.updatePrice);
router.get('/' , priceController.getAllPrice);

module.exports = router;