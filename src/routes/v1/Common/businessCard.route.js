const express = require('express');
const router = express.Router();
const { requireAdmin, requireOwnerOrAdmin } = require('../../../middlewares/access.middleware');
const { BusinessCard } = require('../../../models');

const userAuthMiddleware = require('../../../middlewares/userAuth.middleware');
const businessCardController = require('../../../controllers/Common/businessCard.controller');

router.post('/', businessCardController.createBusinessCard);
router.post('/select-plan', businessCardController.selectBusinessCardPlan);
router.post('/createBusinessCardByAdmin', requireAdmin, businessCardController.createBusinessCardByAdmin);
router.post('/createBusinessCard',[userAuthMiddleware.verifyAuthJWTToken], businessCardController.createBusinessCardWithToken);
router.get('/getMyBusinessCard',[userAuthMiddleware.verifyAuthJWTToken], businessCardController.getMyBusinessCard);
router.get('/getBusinessCardById/:id', businessCardController.getBusinessCardById);
router.put('/updateBusinessCard/:id', requireOwnerOrAdmin({ model: BusinessCard, ownerField: 'user_id', getIds: (req) => req.params.id, allowUnowned: true }), businessCardController.updateBusinessCard);
router.post('/delete', requireAdmin,businessCardController.deleteBusinessCard);

router.get('/getBusinessCard/:slug', businessCardController.getBusinessCard);
router.get('/search', businessCardController.searchBusinessCards);
router.get('/getAllProfiles', businessCardController.getAllProfiles);
router.get("/filter", businessCardController.filterBusinessCards);

// admin apis
router.get('/getAllBusinessCards', requireAdmin, businessCardController.getAllBusinessCards);
router.put('/updateBusinessCardStatus', requireAdmin, businessCardController.updateBusinessCardStatus);
router.put('/:id/featured-links/reorder', requireOwnerOrAdmin({ model: BusinessCard, ownerField: 'user_id', getIds: (req) => req.params.id, allowUnowned: true }), businessCardController.reorderFeaturedLinks);


// business category routes

router.post('/createCategory', requireAdmin, businessCardController.createCategory);
router.get('/getAllCategories', businessCardController.getAllCategories);
router.get('/findCategoryById/:id', businessCardController.findCategoryById);
router.put('/updateCategory/:id', requireAdmin, businessCardController.updateCategory);
router.post('/deleteCategory', requireAdmin, businessCardController.deleteCategory);


// directory routes

router.post('/createDirectory', requireAdmin, businessCardController.createDirectory);
router.put('/updateDirectory/:id', requireAdmin, businessCardController.updateDirectory);
router.post('/deleteDirectory', requireAdmin, businessCardController.deleteDirectory);
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
  "/access-orders", requireAdmin,
  businessCardController.getAllAccessOrders,
);

router.get(
  "/access-orders/:id", requireAdmin,
  businessCardController.getAccessOrderById,
);

router.patch(
  "/access-orders/:id/fulfillment", requireAdmin,
  businessCardController.updateAccessOrderFulfillment,
);



module.exports = router;

