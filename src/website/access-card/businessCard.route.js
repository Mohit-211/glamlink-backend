const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');
const { requireCardAccess } = require('./cardAccess.middleware');

const { requireProfessional } = require('../../shared/identity');
const businessCardController = require('./businessCard.controller');
const { admin: accessAdmin } = require('./access.controller');
const { limitGuestCards } = require('../../core/http/rateLimiter');

router.post('/', limitGuestCards, businessCardController.createBusinessCard);
router.post('/select-plan', requireCardAccess((req) => req.body.business_card_id), businessCardController.selectBusinessCardPlan);
router.post('/createBusinessCardByAdmin', requireAdmin, businessCardController.createBusinessCardByAdmin);
router.post('/createBusinessCard',[requireProfessional], businessCardController.createBusinessCardWithToken);
router.get('/getMyBusinessCard',[requireProfessional], businessCardController.getMyBusinessCard);
router.get('/getBusinessCardById/:id', businessCardController.getBusinessCardById);
router.put('/updateBusinessCard/:id', requireCardAccess((req) => req.params.id, { unownedOnly: true }), businessCardController.updateBusinessCard);
router.post('/delete', requireAdmin,businessCardController.deleteBusinessCard);

router.get('/getBusinessCard/:slug', businessCardController.getBusinessCard);
router.get('/search', businessCardController.searchBusinessCards);
router.get('/getAllProfiles', businessCardController.getAllProfiles);
router.get("/filter", businessCardController.filterBusinessCards);

// admin apis
router.get('/getAllBusinessCards', requireAdmin, businessCardController.getAllBusinessCards);
router.put('/updateBusinessCardStatus', requireAdmin, businessCardController.updateBusinessCardStatus);
router.put('/:id/featured-links/reorder', requireCardAccess((req) => req.params.id, { unownedOnly: true }), businessCardController.reorderFeaturedLinks);


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

router.post("/select-address",[requireProfessional],businessCardController.selectBusinessCardAddress);

router.post("/shipping-rate",[requireProfessional],businessCardController.getBusinessCardShippingRate);
router.get("/payment-history",[requireProfessional],businessCardController.getPaymentHistory);


// The logged-out purchase: the buyer proves it is their card with its card token (cardToken.js)

router.post("/shipping-rate-public", requireCardAccess((req) => req.body.business_card_id), businessCardController.getBusinessCardShippingRatePublic);
router.post("/create-subscription-public", requireCardAccess((req) => req.body.business_card_id), businessCardController.createBusinessCardSubscriptionPublic);


router.post("/create-subscription",[requireProfessional],businessCardController.createBusinessCardSubscription);
router.post("/cancel-subscription",[requireProfessional],businessCardController.cancelBusinessCardSubscription);



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

// The keychain's label with Shippo: today's rates, buy (rate_id optional), void.
router.get("/access-orders/:id/rates", requireAdmin, accessAdmin.orderRates);
router.post("/access-orders/:id/label", requireAdmin, accessAdmin.buyLabel);
router.post("/access-orders/:id/label/void", requireAdmin, accessAdmin.voidLabel);



module.exports = router;

