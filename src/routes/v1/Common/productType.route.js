const express = require('express');
const router = express.Router();

const { productTypeController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

router.post('/createProductType', [userAuthMiddleware.verifyAuthJWTToken], productTypeController.createProductType);
router.get('/getAllProductType', [userAuthMiddleware.verifyAuthJWTToken], productTypeController.getAllProductType);
router.get('/getProductTypeById/:id', productTypeController.getProductTypeById);
router.get('/getProductTypeName',[userAuthMiddleware.verifyAuthJWTToken], productTypeController.getProductTypeName);
router.put('/updateProductType/:id', productTypeController.updateProductType);
router.post('/delete', productTypeController.deleteProductType);


module.exports = router;

