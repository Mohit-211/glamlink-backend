const express = require('express');
const router = express.Router();

const numeralController = require('./numeral.controller');
const { authenticate } = require('../../core/auth/authenticate');



router.post('/calculate-checkout-tax',[authenticate], numeralController.calculateCheckoutTax);



module.exports = router;