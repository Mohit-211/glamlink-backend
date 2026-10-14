const express = require('express');
const router = express.Router();

const numeralController = require('./numeral.controller');
const userAuthMiddleware = require('../../core/auth/userAuth.middleware');



router.post('/calculate-checkout-tax',[userAuthMiddleware.verifyAuthJWTToken], numeralController.calculateCheckoutTax);



module.exports = router;