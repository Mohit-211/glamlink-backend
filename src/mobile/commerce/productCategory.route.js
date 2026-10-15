const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');

const productCategoryController = require('./productCategory.controller');


router.post('/createProductCategoryHeading', requireAdmin,productCategoryController.createProductCategoryHeading);
router.post('/createProductCategory', requireAdmin,productCategoryController.createProductCategory);
router.get('/getAllProductCategories', productCategoryController.getAllProductCategories);
router.post('/getProductCategoryByCategoryId', productCategoryController.getProductCategoryByCategoryId);
router.get('/findProductCategoryById/:id', productCategoryController.findProductCategoryById);
router.get('/getProductCategoryName', productCategoryController.getProductCategoryName);
router.get('/getAllProductCategoryName', productCategoryController.getAllProductCategoryName);
router.put('/updateProductCategoryHeading/:id', requireAdmin, productCategoryController.updateProductCategoryHeading);
router.put('/updateProductCategory/:id', requireAdmin, productCategoryController.updateProductCategory);
router.post('/delete', requireAdmin, productCategoryController.deleteProductCategoryHeading);
router.post('/deleteProductCategory', requireAdmin, productCategoryController.deleteProductCategory);

router.get('/getProductCategory', productCategoryController.getProductCategory);

module.exports = router;