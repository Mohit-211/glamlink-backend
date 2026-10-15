const express = require("express");
const router = express.Router();
const { requireAdmin, requireOwnerOrAdmin } = require('../../shared/admin');
const { BusinessCard } = require('../../models');

const accessCardAnalyticsController = require("./accessCardAnalytics.controller");

router.post("/event", accessCardAnalyticsController.trackAccessCardEvent);

router.get(
  "/overview", requireAdmin,
  accessCardAnalyticsController.getAccessCardAnalyticsOverview,
);

router.get(
  "/:businessCardId/events", requireOwnerOrAdmin({ model: BusinessCard, ownerField: 'user_id', getIds: (req) => req.params.businessCardId }),
  accessCardAnalyticsController.getAccessCardAnalyticsEvents,
);

router.get(
  "/:businessCardId", requireOwnerOrAdmin({ model: BusinessCard, ownerField: 'user_id', getIds: (req) => req.params.businessCardId }),
  accessCardAnalyticsController.getAccessCardAnalytics,
);

module.exports = router;
