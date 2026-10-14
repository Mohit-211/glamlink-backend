const express = require('express');
const router = express.Router();

const numeralController = require('../../../controllers/Common/numeral.controller');
const userAuthMiddleware = require('../../../middlewares/userAuth.middleware');



router.post('/calculate-checkout-tax',[userAuthMiddleware.verifyAuthJWTToken], numeralController.calculateCheckoutTax);



module.exports = router;