const express = require('express');
const router = express.Router();

const cityController = require('../../../controllers/Common/city.controller');


router.get('/',cityController.getAllCity);
router.get('/:id',cityController.getCityById);

module.exports = router;