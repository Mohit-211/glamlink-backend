const express = require('express');
const router = express.Router();
const { requireAdmin, requireOwnerOrAdmin } = require('../../../middlewares/access.middleware');
const { Product } = require('../../../models');

const productController = require('../../../controllers/Common/product.controller');
const userAuthMiddleware = require('../../../middlewares/userAuth.middleware');

router.post('/createProduct', [userAuthMiddleware.verifyAuthJWTToken],productController.createProduct);
router.get('/getAllProducts',[userAuthMiddleware.verifyAuthJWTToken],  productController.getAllProducts);
router.get('/getAllProductsByBeuticianId/:id',productController.getAllProductsByBeuticianId);
router.get('/findProductById/:id',[userAuthMiddleware.verifyAuthJWTToken],  productController.findProductById);
router.put('/updateProduct/:id', requireOwnerOrAdmin({ model: Product, ownerField: 'user_id', getIds: (req) => req.params.id }), productController.updateProduct);
router.post('/delete', requireOwnerOrAdmin({ model: Product, ownerField: 'user_id', getIds: (req) => req.body.product_id }), productController.deleteProduct);
router.post('/getAllProductsForUser',[userAuthMiddleware.verifyAuthJWTToken], productController.getAllProductsForUser);


router.get('/getAllProductsForAdmin', requireAdmin, productController.getAllProductsForAdmin);
router.get('/getPendingProductCount', requireAdmin,productController.getPendingProductCount);
router.get('/getProductById/:id',productController.getProductById);
router.post('/updateProductStatus/:id', requireAdmin, productController.updateProductStatus);

router.post('/provideServiceLocation', [userAuthMiddleware.verifyAuthJWTToken],productController.provideServiceLocation);
router.get('/checkServiceLocation',[userAuthMiddleware.verifyAuthJWTToken],  productController.checkServiceLocation);
router.get('/getAllServiceLocations',[userAuthMiddleware.verifyAuthJWTToken],  productController.getAllServiceLocations);
router.delete('/deleteServiceLocations',[userAuthMiddleware.verifyAuthJWTToken],  productController.deleteServiceLocations);



module.exports = router;

