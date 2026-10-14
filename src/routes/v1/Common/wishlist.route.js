const express = require('express');
const router = express.Router();

const wishlistController = require('../../../controllers/Common/wishlist.controller');
const userAuthMiddleware = require('../../../middlewares/userAuth.middleware');

router.post('/addToWishlist' , [userAuthMiddleware.verifyAuthJWTToken] ,wishlistController.addToWishlist);
router.get('/getAllItemsFromWishlist' , [userAuthMiddleware.verifyAuthJWTToken] ,wishlistController.getAllItemsFromWishlist);
router.delete('/removeProductFromWishlist',[userAuthMiddleware.verifyAuthJWTToken], wishlistController.removeProductFromWishlist);


module.exports = router;