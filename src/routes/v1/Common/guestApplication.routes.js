/** @format */

const express = require("express");
const { guestApplicationController } = require("../../../controllers");
const router = express.Router();



// Public (form submit)
router.post("/create", guestApplicationController.createGuestApplication);

// Admin
router.get("/list", guestApplicationController.getAllGuestApplications);
router.get("/:id", guestApplicationController.getGuestApplicationById);
router.post("/delete", guestApplicationController.deleteGuestApplication);

module.exports = router;