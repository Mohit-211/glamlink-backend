const express = require('express');
const router = express.Router();

const { numeralTaxController } = require('../../../controllers');

router.post('/createTaxCategory',  numeralTaxController.createTaxCategory);
router.get('/getTaxCategoryById/:id', numeralTaxController.getTaxCategoryById);
router.get('/getTaxCategoryName', numeralTaxController.getTaxCategoryName);
router.put('/updateTaxCategory/:id', numeralTaxController.updateTaxCategory);
router.post('/delete', numeralTaxController.deleteTaxCategory);


module.exports = router;

