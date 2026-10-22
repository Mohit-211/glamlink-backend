const express = require('express');
const router = express.Router();
const searchController = require('./search.controller');

// Every public page's id, slug and date of last change, by kind.
router.get('/', searchController.sitemap);

module.exports = router;
