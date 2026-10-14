const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../../middlewares/access.middleware');

const productTypeController = require('../../../controllers/Common/productType.controller');
const userAuthMiddleware = require('../../../middlewares/userAuth.middleware');

router.post('/createProductType', [userAuthMiddleware.verifyAuthJWTToken], productTypeController.createProductType);
router.get('/getAllProductType', [userAuthMiddleware.verifyAuthJWTToken], productTypeController.getAllProductType);
router.get('/getProductTypeById/:id', requireAdmin, productTypeController.getProductTypeById);
router.get('/getProductTypeName',[userAuthMiddleware.verifyAuthJWTToken], productTypeController.getProductTypeName);
router.put('/updateProductType/:id', requireAdmin, productTypeController.updateProductType);
router.post('/delete', requireAdmin, productTypeController.deleteProductType);


module.exports = router;

