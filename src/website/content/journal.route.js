const express = require("express");

const router = express.Router();
const { requireAdmin } = require('../../shared/admin');

const journalController = require("./journal.controller");

// ==========================================
// Journal
// ==========================================

router.post("/", requireAdmin, journalController.createJournal);

router.get("/", journalController.getAllJournals);

router.get("/admin", requireAdmin, journalController.getAllJournalsByAdmin);

router.get("/findJournalById/:id", journalController.findJournalById);

router.get("/slug/:slug", journalController.findJournalBySlug);

router.put("/:id", requireAdmin, journalController.updateJournal);

router.post("/delete", requireAdmin, journalController.deleteJournal);

router.post("/upload", requireAdmin, journalController.uploadImage);

router.post("/sort-order", requireAdmin, journalController.updateJournalSortOrder);

// ==========================================
// FAQ CRUD
// ==========================================

router.post("/faq", requireAdmin, journalController.createJournalFaq);

router.get("/faq", journalController.getAllJournalFaqs);

router.get("/faq/:id", journalController.getJournalFaqById);

router.put("/faq/:id", requireAdmin, journalController.updateJournalFaq);

router.post("/faq/delete", requireAdmin, journalController.deleteJournalFaq);

// ==========================================
// Topic CRUD
// ==========================================

router.post("/topic", requireAdmin, journalController.createJournalTopic);

router.get("/topic", journalController.getAllJournalTopics);

router.get("/topic/:id", journalController.getJournalTopicById);

router.put("/topic/:id", requireAdmin, journalController.updateJournalTopic);

router.post("/topic/delete", requireAdmin, journalController.deleteJournalTopic);

// ==========================================
// Journal FAQ Mapping
// ==========================================

router.get("/:id/faqs", journalController.getJournalFaqMappings);

router.post("/:id/faqs", requireAdmin, journalController.updateJournalFaqMappings);

// ==========================================
// Mentions: who an article features
// ==========================================

router.get("/:id/mentions", requireAdmin, journalController.getArticleMentions);

router.post("/:id/mentions", requireAdmin, journalController.addArticleMention);

router.put("/:id/mentions/:mentionId", requireAdmin, journalController.updateArticleMention);

router.delete("/:id/mentions/:mentionId", requireAdmin, journalController.removeArticleMention);

// ==========================================
// Journal Topic Mapping
// ==========================================

router.get("/:id/topics", journalController.getJournalTopicMappings);

router.post("/:id/topics", requireAdmin, journalController.updateJournalTopicMappings);

// ==========================================
// Topic Professionals
// ==========================================

router.put(
  "/topic/:id/professionals", requireAdmin,
  journalController.updateJournalTopicProfessionals,
);

// ==========================================
// Topic Products
// ==========================================

router.put("/topic/:id/shops", requireAdmin, journalController.updateJournalTopicShops);

// ==========================================
// Topic Podcasts
// ==========================================

router.put("/topic/:id/podcasts", requireAdmin, journalController.updateJournalTopicPodcasts);

// ==========================================
// Topic Paragraphs
// ==========================================

router.get(
  "/topic/:id/paragraphs",
  journalController.getJournalTopicParagraphs,
);

router.put(
  "/topic/:id/paragraphs", requireAdmin,
  journalController.updateJournalTopicParagraphs,
);

// ==========================================
// Journal by Category
// IMPORTANT: Keep this LAST
// ==========================================

router.get("/:category_id", journalController.getJournalsByCategory);

module.exports = router;
