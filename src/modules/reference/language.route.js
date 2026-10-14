const express = require('express');
const router = express.Router();

const languageController = require('./language.controller');

router.get('/', languageController.getAllLanguage);


module.exports = router;