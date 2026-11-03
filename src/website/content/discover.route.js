const express = require("express");
const router = express.Router();
const { requireAdmin } = require('../../shared/admin');

const discoverController = require("./discover.controller");


// The shop's filter values: its categories and brands with counts.
router.get("/shop/filters", discoverController.getShopFilters);

// Product tags (Nov 4): the list is public, admins keep it. Before /:type, as /shop/filters is.
router.get("/shop/tags", discoverController.listShopTags);
router.post("/shop/tags", requireAdmin, discoverController.createShopTag);
router.put("/shop/tags/order", requireAdmin, discoverController.orderShopTags);
router.put("/shop/tags/:id", requireAdmin, discoverController.updateShopTag);
router.delete("/shop/tags/:id", requireAdmin, discoverController.deleteShopTag);

// A product by its slug (by its id: /shop/findById/:id).
router.get("/shop/slug/:slug", discoverController.findProductBySlug);

router.post("/:type", requireAdmin, discoverController.createDiscover);
router.get("/:type", discoverController.getAllDiscover);
router.get("/:type/findById/:id", discoverController.findDiscoverById);

// Admin APIs
router.get("/:type/admin", requireAdmin, discoverController.getAllDiscoverByAdmin);
router.put("/:type/:id", requireAdmin, discoverController.updateDiscover);
router.post("/:type/delete", requireAdmin, discoverController.deleteDiscover);
router.post("/:type/sort-order", requireAdmin, discoverController.updateDiscoverSortOrder);

router.post("/:type/csv-upload", requireAdmin, discoverController.bulkUploadDiscoverCsv);


module.exports = router;