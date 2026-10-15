const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');

const productTypeController = require('./productType.controller');
const { authenticate } = require('../../shared/identity');

router.post('/createProductType', [authenticate], productTypeController.createProductType);
router.get('/getAllProductType', [authenticate], productTypeController.getAllProductType);
router.get('/getProductTypeById/:id', requireAdmin, productTypeController.getProductTypeById);
router.get('/getProductTypeName',[authenticate], productTypeController.getProductTypeName);
router.put('/updateProductType/:id', requireAdmin, productTypeController.updateProductType);
router.post('/delete', requireAdmin, productTypeController.deleteProductType);


module.exports = router;

