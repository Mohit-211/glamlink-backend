const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin/access.middleware');

const faqController = require('./faq.controller');

router.post('/' , requireAdmin, faqController.createFaq);
router.get('/' , faqController.getAllFaq);
router.get('/:id' , faqController.getFaqById);
router.put('/:id' , requireAdmin, faqController.updateFaq);
router.delete('/:id' , requireAdmin, faqController.deleteFaq);

module.exports = router;