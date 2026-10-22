const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');
const { limitSearches } = require('../../core/http/rateLimiter');
const searchController = require('./search.controller');

router.get('/', limitSearches, searchController.search);
router.get('/admin/terms', requireAdmin, searchController.terms);

module.exports = router;
