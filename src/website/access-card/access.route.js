const express = require('express');
const { authenticate, requireProfessional } = require('../../shared/identity');
const { requireAdmin } = require('../../shared/admin');
const accessController = require('./access.controller');

// /access: the Access card's plans, purchase and ownership, and the admin's pricing (docs/access.md).
const router = express.Router();

router.get('/plans', accessController.plans);
router.post('/cards/:id/claim', authenticate, accessController.claim);
router.delete('/cards/:id', requireProfessional, accessController.remove);

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

module.exports = router;
