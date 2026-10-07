const express = require('express');
const router = express.Router();

const { numeralController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');



router.post('/calculate-checkout-tax',[userAuthMiddleware.verifyAuthJWTToken], numeralController.calculateCheckoutTax);



module.exports = router;