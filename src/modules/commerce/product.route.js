const express = require('express');
const router = express.Router();
const { requireAdmin, requireOwnerOrAdmin } = require('../../core/auth/access.middleware');
const { Product } = require('../../models');

const productController = require('./product.controller');
const { authenticate, optionalAuth } = require('../../core/auth/authenticate');

router.post('/createProduct', [authenticate],productController.createProduct);
router.get('/getAllProducts',[authenticate],  productController.getAllProducts);
router.get('/getAllProductsByBeuticianId/:id',productController.getAllProductsByBeuticianId);
router.get('/findProductById/:id',[authenticate],  productController.findProductById);
router.put('/updateProduct/:id', requireOwnerOrAdmin({ model: Product, ownerField: 'user_id', getIds: (req) => req.params.id }), productController.updateProduct);
router.post('/delete', requireOwnerOrAdmin({ model: Product, ownerField: 'user_id', getIds: (req) => req.body.product_id }), productController.deleteProduct);
router.post('/getAllProductsForUser',[optionalAuth], productController.getAllProductsForUser);


router.get('/getAllProductsForAdmin', requireAdmin, productController.getAllProductsForAdmin);
router.get('/getPendingProductCount', requireAdmin,productController.getPendingProductCount);
router.get('/getProductById/:id',productController.getProductById);
router.post('/updateProductStatus/:id', requireAdmin, productController.updateProductStatus);

router.post('/provideServiceLocation', [authenticate],productController.provideServiceLocation);
router.get('/checkServiceLocation',[authenticate],  productController.checkServiceLocation);
router.get('/getAllServiceLocations',[authenticate],  productController.getAllServiceLocations);
router.delete('/deleteServiceLocations',[authenticate],  productController.deleteServiceLocations);



module.exports = router;

