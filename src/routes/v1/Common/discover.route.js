/** @format */

const express = require("express");
const router = express.Router();
const { requireAdmin } = require('../../../middlewares/access.middleware');

const { discoverController } = require("../../../controllers");


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