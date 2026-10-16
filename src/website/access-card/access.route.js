const express = require('express');
const { authenticate, requireProfessional } = require('../../shared/identity');
const { requireAdmin } = require('../../shared/admin');
const accessController = require('./access.controller');
const { requireCardAccess } = require('./cardAccess.middleware');

// /access: the Access card's plans, purchase and ownership, and the admin's pricing (docs/access.md).
const router = express.Router();

router.get('/plans', accessController.plans);
router.post('/cards/:id/claim', authenticate, accessController.claim);
router.delete('/cards/:id', requireProfessional, accessController.remove);

// Buying: the card's owner, an admin, or the guest with the card's token.
const cardOf = (req) => req.body.business_card_id;
const checkoutCard = (req) => req.checkout.business_card_id;
router.post('/checkout/quote', requireCardAccess(cardOf), accessController.quoteCheckout);
router.post('/checkout/:id/pay', accessController.loadCheckout, requireCardAccess(checkoutCard), accessController.payCheckout);
router.get('/checkout/:id', accessController.loadCheckout, requireCardAccess(checkoutCard), accessController.getCheckout);

router.get('/subscription', requireProfessional, accessController.mySubscription);
router.post('/subscription/cancel', requireProfessional, accessController.cancelMine);
router.post('/subscription/resume', requireProfessional, accessController.resumeMine);

const { admin } = accessController;
router.get('/admin/catalog', requireAdmin, admin.catalog);
router.put('/admin/plans/:code', requireAdmin, admin.updatePlan);
router.put('/admin/products/:code/price', requireAdmin, admin.changePrice);
router.get('/admin/price-changes', requireAdmin, admin.priceChanges);
router.get('/admin/discounts', requireAdmin, admin.discounts);
router.post('/admin/discounts', requireAdmin, admin.createDiscount);
router.patch('/admin/discounts/:id', requireAdmin, admin.updateDiscount);
router.post('/admin/discounts/:id/end', requireAdmin, admin.endDiscount);
router.get('/admin/custom-prices', requireAdmin, admin.overrides);
router.post('/admin/custom-prices', requireAdmin, admin.createOverride);
router.post('/admin/custom-prices/:id/end', requireAdmin, admin.endOverride);
router.put('/admin/settings', requireAdmin, admin.updateSettings);
router.get('/admin/subscriptions', requireAdmin, admin.subscriptions);
router.post('/admin/subscriptions/:userId/cancel', requireAdmin, admin.cancelSubscription);
router.put('/admin/subscriptions/:userId/comp', requireAdmin, admin.setComp);

module.exports = router;
