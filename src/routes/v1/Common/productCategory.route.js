const express = require('express');
const router = express.Router();

const { productCategoryController } = require('../../../controllers');
const {adminAuthMiddleware} = require('../../../middlewares');


router.post('/createProductCategoryHeading',productCategoryController.createProductCategoryHeading);
router.post('/createProductCategory',productCategoryController.createProductCategory);
router.get('/getAllProductCategories', productCategoryController.getAllProductCategories);
router.post('/getProductCategoryByCategoryId', productCategoryController.getProductCategoryByCategoryId);
router.get('/findProductCategoryById/:id', productCategoryController.findProductCategoryById);
router.get('/getProductCategoryName', productCategoryController.getProductCategoryName);
router.get('/getAllProductCategoryName', productCategoryController.getAllProductCategoryName);
router.put('/updateProductCategoryHeading/:id', productCategoryController.updateProductCategoryHeading);
router.put('/updateProductCategory/:id', productCategoryController.updateProductCategory);
router.post('/delete', productCategoryController.deleteProductCategoryHeading);
router.post('/deleteProductCategory', productCategoryController.deleteProductCategory);

router.get('/getProductCategory', productCategoryController.getProductCategory);

module.exports = router;