/** @format */

const express = require("express");
const router = express.Router();

const { discoverController } = require("../../../controllers");


router.post("/:type", discoverController.createDiscover);
router.get("/:type", discoverController.getAllDiscover);
router.get("/:type/findById/:id", discoverController.findDiscoverById);

// Admin APIs
router.get("/:type/admin", discoverController.getAllDiscoverByAdmin);
router.put("/:type/:id", discoverController.updateDiscover);
router.post("/:type/delete", discoverController.deleteDiscover);
router.post("/:type/sort-order", discoverController.updateDiscoverSortOrder);

router.post("/:type/csv-upload", discoverController.bulkUploadDiscoverCsv);


module.exports = router;