const express = require('express');
const router = express.Router();

const wishlistController = require('./wishlist.controller');
const { authenticate } = require('../../shared/identity/authenticate');

router.post('/addToWishlist' , [authenticate] ,wishlistController.addToWishlist);
router.get('/getAllItemsFromWishlist' , [authenticate] ,wishlistController.getAllItemsFromWishlist);
router.delete('/removeProductFromWishlist',[authenticate], wishlistController.removeProductFromWishlist);


module.exports = router;