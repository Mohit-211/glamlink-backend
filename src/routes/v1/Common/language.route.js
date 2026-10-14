const express = require('express');
const router = express.Router();

const languageController = require('../../../controllers/Common/language.controller');

router.get('/', languageController.getAllLanguage);


module.exports = router;