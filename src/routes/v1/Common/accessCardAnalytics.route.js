const express = require("express");
const router = express.Router();

const { accessCardAnalyticsController } = require("../../../controllers");

router.post("/event", accessCardAnalyticsController.trackAccessCardEvent);

router.get(
  "/overview",
  accessCardAnalyticsController.getAccessCardAnalyticsOverview,
);

router.get(
  "/:businessCardId/events",
  accessCardAnalyticsController.getAccessCardAnalyticsEvents,
);

router.get(
  "/:businessCardId",
  accessCardAnalyticsController.getAccessCardAnalytics,
);

module.exports = router;
