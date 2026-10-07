const express = require('express');
const router = express.Router();

const { cartController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');



router.post('/addItemToCart',[userAuthMiddleware.verifyAuthJWTToken], cartController.addItemToCart);
router.post('/updateProductQuantity',[userAuthMiddleware.verifyAuthJWTToken], cartController.updateProductQuantity);
router.post('/removeProduct',[userAuthMiddleware.verifyAuthJWTToken], cartController.removeProduct);
router.get('/getAllProductsInCart',[userAuthMiddleware.verifyAuthJWTToken], cartController.getAllProductsInCart);


module.exports = router;