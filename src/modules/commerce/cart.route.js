const express = require('express');
const router = express.Router();

const cartController = require('./cart.controller');
const userAuthMiddleware = require('../../core/auth/userAuth.middleware');



router.post('/addItemToCart',[userAuthMiddleware.verifyAuthJWTToken], cartController.addItemToCart);
router.post('/updateProductQuantity',[userAuthMiddleware.verifyAuthJWTToken], cartController.updateProductQuantity);
router.post('/removeProduct',[userAuthMiddleware.verifyAuthJWTToken], cartController.removeProduct);
router.get('/getAllProductsInCart',[userAuthMiddleware.verifyAuthJWTToken], cartController.getAllProductsInCart);


module.exports = router;