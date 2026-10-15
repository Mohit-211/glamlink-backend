const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');

const numeralTaxController = require('./numeralTaxCategory.controller');

router.post('/createTaxCategory', requireAdmin,  numeralTaxController.createTaxCategory);
router.get('/getTaxCategoryById/:id', numeralTaxController.getTaxCategoryById);
router.get('/getTaxCategoryName', numeralTaxController.getTaxCategoryName);
router.put('/updateTaxCategory/:id', requireAdmin, numeralTaxController.updateTaxCategory);
router.post('/delete', requireAdmin, numeralTaxController.deleteTaxCategory);


module.exports = router;

