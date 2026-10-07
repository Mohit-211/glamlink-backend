const express = require('express');
const router = express.Router();

const { productController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

router.post('/createProduct', [userAuthMiddleware.verifyAuthJWTToken],productController.createProduct);
router.get('/getAllProducts',[userAuthMiddleware.verifyAuthJWTToken],  productController.getAllProducts);
router.get('/getAllProductsByBeuticianId/:id',productController.getAllProductsByBeuticianId);
router.get('/findProductById/:id',[userAuthMiddleware.verifyAuthJWTToken],  productController.findProductById);
router.put('/updateProduct/:id', productController.updateProduct);
router.post('/delete', productController.deleteProduct);
router.post('/getAllProductsForUser',[userAuthMiddleware.verifyAuthJWTToken], productController.getAllProductsForUser);


router.get('/getAllProductsForAdmin', productController.getAllProductsForAdmin);
router.get('/getPendingProductCount',productController.getPendingProductCount);
router.get('/getProductById/:id',productController.getProductById);
router.post('/updateProductStatus/:id', productController.updateProductStatus);

router.post('/provideServiceLocation', [userAuthMiddleware.verifyAuthJWTToken],productController.provideServiceLocation);
router.get('/checkServiceLocation',[userAuthMiddleware.verifyAuthJWTToken],  productController.checkServiceLocation);
router.get('/getAllServiceLocations',[userAuthMiddleware.verifyAuthJWTToken],  productController.getAllServiceLocations);
router.delete('/deleteServiceLocations',[userAuthMiddleware.verifyAuthJWTToken],  productController.deleteServiceLocations);



module.exports = router;

