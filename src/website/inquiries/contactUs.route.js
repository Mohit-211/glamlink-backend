const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');

const contactUsController = require('./contactUs.controller');

router.post('/', contactUsController.createContactUs);
router.put('/:id', requireAdmin, contactUsController.updateContactUs);
router.get('/', requireAdmin, contactUsController.getAllContactUs);
router.get('/all', requireAdmin, contactUsController.getAllContactUsForAdmin);
router.delete('/:id', requireAdmin, contactUsController.deleteContactUs);


module.exports = router;