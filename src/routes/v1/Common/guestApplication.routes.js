/** @format */

const express = require("express");
const { guestApplicationController } = require("../../../controllers");
const router = express.Router();
const { requireAdmin } = require('../../../middlewares/access.middleware');



// Public (form submit)
router.post("/create", guestApplicationController.createGuestApplication);

// Admin
router.get("/list", requireAdmin, guestApplicationController.getAllGuestApplications);
router.get("/:id", requireAdmin, guestApplicationController.getGuestApplicationById);
router.post("/delete", requireAdmin, guestApplicationController.deleteGuestApplication);

module.exports = router;