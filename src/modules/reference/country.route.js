const express = require('express');
const router = express.Router();

const countryController = require('./country.controller');


router.get('/',countryController.getAllCountry);
router.get('/:id',countryController.getCountryId);

module.exports = router;