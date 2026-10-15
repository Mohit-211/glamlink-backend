const express = require('express');
const router = express.Router();

const cartController = require('./cart.controller');
const { authenticate } = require('../../shared/identity/authenticate');



router.post('/addItemToCart',[authenticate], cartController.addItemToCart);
router.post('/updateProductQuantity',[authenticate], cartController.updateProductQuantity);
router.post('/removeProduct',[authenticate], cartController.removeProduct);
router.get('/getAllProductsInCart',[authenticate], cartController.getAllProductsInCart);


module.exports = router;