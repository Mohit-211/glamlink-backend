const express = require('express');
const router = express.Router();

const {priceController} = require('../../../controllers');
const {adminAuthMiddleware} = require('../../../middlewares');

router.post('/' , [ adminAuthMiddleware.validateJWTtoken] ,priceController.createPrice);
router.put('/:priceId' , [ adminAuthMiddleware.validateJWTtoken], priceController.updatePrice);
router.get('/' , priceController.getAllPrice);
// router.delete('/:priceId' , [ adminAuthMiddleware.validateJWTtoken], priceController.deletePrice);

module.exports = router;