const express = require('express');
const router = express.Router();

const numeralController = require('./numeral.controller');
const { authenticate } = require('../../shared/identity/authenticate');



router.post('/calculate-checkout-tax',[authenticate], numeralController.calculateCheckoutTax);



module.exports = router;