/** @format */

const express = require("express");
const guestApplicationController = require("./guestApplication.controller");
const router = express.Router();
const { requireAdmin } = require('../../shared/admin/access.middleware');



// Public (form submit)
router.post("/create", guestApplicationController.createGuestApplication);

// Admin
router.get("/list", requireAdmin, guestApplicationController.getAllGuestApplications);
router.get("/:id", requireAdmin, guestApplicationController.getGuestApplicationById);
router.post("/delete", requireAdmin, guestApplicationController.deleteGuestApplication);

module.exports = router;