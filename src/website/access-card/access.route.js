const express = require('express');
const { authenticate, requireProfessional } = require('../../shared/identity');
const accessController = require('./access.controller');

// /access: the Access card's purchase and ownership (docs/access.md).
const router = express.Router();

router.post('/cards/:id/claim', authenticate, accessController.claim);
router.delete('/cards/:id', requireProfessional, accessController.remove);

module.exports = router;
