const express = require('express');
const router = express.Router();

const { languageController } = require('../../../controllers');

router.get('/', languageController.getAllLanguage);


module.exports = router;