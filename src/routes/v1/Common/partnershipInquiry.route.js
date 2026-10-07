const express = require("express");

const { partnershipInquiryController } = require("../../../controllers/Common");

const router = express.Router();

// Public
router.post("/", partnershipInquiryController.createPartnershipInquiry);

// Admin
router.get("/", partnershipInquiryController.getAllPartnershipInquiries);

router.get("/:id", partnershipInquiryController.findPartnershipInquiryById);

router.post("/delete", partnershipInquiryController.deletePartnershipInquiry);

module.exports = router;
