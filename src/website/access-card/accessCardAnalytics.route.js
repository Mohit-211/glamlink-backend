const express = require("express");
const router = express.Router();
const { requireAdmin, requireOwnerOrAdmin } = require('../../shared/admin');
const { BusinessCard } = require('../../models');
const { requireAnalyticsPlan } = require('./entitlements');

const accessCardAnalyticsController = require("./accessCardAnalytics.controller");

router.post("/event", accessCardAnalyticsController.trackAccessCardEvent);

router.get(
  "/overview", requireAdmin,
  accessCardAnalyticsController.getAccessCardAnalyticsOverview,
);

// A card's analytics: its owner on Access Pro (UPGRADE_REQUIRED on Free), or an admin.
const ownerOrAdmin = requireOwnerOrAdmin({ model: BusinessCard, ownerField: 'user_id', getIds: (req) => req.params.businessCardId });

router.get(
  "/:businessCardId/events", ownerOrAdmin, requireAnalyticsPlan,
  accessCardAnalyticsController.getAccessCardAnalyticsEvents,
);

router.get(
  "/:businessCardId", ownerOrAdmin, requireAnalyticsPlan,
  accessCardAnalyticsController.getAccessCardAnalytics,
);

module.exports = router;
