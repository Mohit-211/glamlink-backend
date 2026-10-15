const express = require("express");

const partnershipInquiryController = require("./partnershipInquiry.controller");

const router = express.Router();
const { requireAdmin } = require('../../shared/admin/access.middleware');

// Public
router.post("/", partnershipInquiryController.createPartnershipInquiry);

// Admin
router.get("/", requireAdmin, partnershipInquiryController.getAllPartnershipInquiries);

router.get("/:id", requireAdmin, partnershipInquiryController.findPartnershipInquiryById);

router.post("/delete", requireAdmin, partnershipInquiryController.deletePartnershipInquiry);

module.exports = router;
