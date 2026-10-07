const express = require('express');
const router = express.Router();

const { userAuthMiddleware } = require('../../../middlewares');
const { businessCardController } = require('../../../controllers/Common');

router.post('/', businessCardController.createBusinessCard);
router.post('/select-plan', businessCardController.selectBusinessCardPlan);
router.post('/createBusinessCardByAdmin', businessCardController.createBusinessCardByAdmin);
router.post('/createBusinessCard',[userAuthMiddleware.verifyAuthJWTToken], businessCardController.createBusinessCardWithToken);
router.get('/getMyBusinessCard',[userAuthMiddleware.verifyAuthJWTToken], businessCardController.getMyBusinessCard);
router.get('/getBusinessCardById/:id', businessCardController.getBusinessCardById);
router.put('/updateBusinessCard/:id', businessCardController.updateBusinessCard);
router.post('/delete',businessCardController.deleteBusinessCard);

router.get('/getBusinessCard/:slug', businessCardController.getBusinessCard);
router.get('/search', businessCardController.searchBusinessCards);
router.get('/getAllProfiles', businessCardController.getAllProfiles);
router.get("/filter", businessCardController.filterBusinessCards);

// admin apis
router.get('/getAllBusinessCards', businessCardController.getAllBusinessCards);
router.put('/updateBusinessCardStatus', businessCardController.updateBusinessCardStatus);
router.put('/:id/featured-links/reorder', businessCardController.reorderFeaturedLinks);


// business category routes

router.post('/createCategory', businessCardController.createCategory);
router.get('/getAllCategories', businessCardController.getAllCategories);
router.get('/findCategoryById/:id', businessCardController.findCategoryById);
router.put('/updateCategory/:id', businessCardController.updateCategory);
router.post('/deleteCategory', businessCardController.deleteCategory);


// directory routes

router.post('/createDirectory', businessCardController.createDirectory);
router.put('/updateDirectory/:id', businessCardController.updateDirectory);
router.post('/deleteDirectory', businessCardController.deleteDirectory);
router.get('/getAllDirectories', businessCardController.getAllDirectories);
router.get('/getProfilesByDirectory/:id', businessCardController.getProfilesByDirectory);

router.post("/select-address",[userAuthMiddleware.verifyAuthJWTToken],businessCardController.selectBusinessCardAddress);

router.post("/shipping-rate",[userAuthMiddleware.verifyAuthJWTToken],businessCardController.getBusinessCardShippingRate);
router.get("/payment-history",[userAuthMiddleware.verifyAuthJWTToken],businessCardController.getPaymentHistory);


// without token apis for logged our user

router.post("/shipping-rate-public",businessCardController.getBusinessCardShippingRatePublic);
router.post("/create-subscription-public",businessCardController.createBusinessCardSubscriptionPublic);


router.post("/create-subscription",[userAuthMiddleware.verifyAuthJWTToken],businessCardController.createBusinessCardSubscription);
router.post("/cancel-subscription",[userAuthMiddleware.verifyAuthJWTToken],businessCardController.cancelBusinessCardSubscription);



router.get(
  "/access-orders",
  businessCardController.getAllAccessOrders,
);

router.get(
  "/access-orders/:id",
  businessCardController.getAccessOrderById,
);

router.patch(
  "/access-orders/:id/fulfillment",
  businessCardController.updateAccessOrderFulfillment,
);



module.exports = router;

