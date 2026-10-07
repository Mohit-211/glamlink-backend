const express = require("express");

const router = express.Router();

const { journalController } = require("../../../controllers");

// ==========================================
// Journal
// ==========================================

router.post("/", journalController.createJournal);

router.get("/", journalController.getAllJournals);

router.get("/admin", journalController.getAllJournalsByAdmin);

router.get("/findJournalById/:id", journalController.findJournalById);

router.put("/:id", journalController.updateJournal);

router.post("/delete", journalController.deleteJournal);

router.post("/upload", journalController.uploadImage);

router.post("/sort-order", journalController.updateJournalSortOrder);

// ==========================================
// FAQ CRUD
// ==========================================

router.post("/faq", journalController.createJournalFaq);

router.get("/faq", journalController.getAllJournalFaqs);

router.get("/faq/:id", journalController.getJournalFaqById);

router.put("/faq/:id", journalController.updateJournalFaq);

router.post("/faq/delete", journalController.deleteJournalFaq);

// ==========================================
// Topic CRUD
// ==========================================

router.post("/topic", journalController.createJournalTopic);

router.get("/topic", journalController.getAllJournalTopics);

router.get("/topic/:id", journalController.getJournalTopicById);

router.put("/topic/:id", journalController.updateJournalTopic);

router.post("/topic/delete", journalController.deleteJournalTopic);

// ==========================================
// Journal FAQ Mapping
// ==========================================

router.get("/:id/faqs", journalController.getJournalFaqMappings);

router.post("/:id/faqs", journalController.updateJournalFaqMappings);

// ==========================================
// Journal Topic Mapping
// ==========================================

router.get("/:id/topics", journalController.getJournalTopicMappings);

router.post("/:id/topics", journalController.updateJournalTopicMappings);

// ==========================================
// Topic Professionals
// ==========================================

router.put(
  "/topic/:id/professionals",
  journalController.updateJournalTopicProfessionals,
);

// ==========================================
// Topic Products
// ==========================================

router.put("/topic/:id/shops", journalController.updateJournalTopicShops);

// ==========================================
// Topic Podcasts
// ==========================================

router.put("/topic/:id/podcasts", journalController.updateJournalTopicPodcasts);

// ==========================================
// Topic Paragraphs
// ==========================================

router.get(
  "/topic/:id/paragraphs",
  journalController.getJournalTopicParagraphs,
);

router.put(
  "/topic/:id/paragraphs",
  journalController.updateJournalTopicParagraphs,
);

// ==========================================
// Journal by Category
// IMPORTANT: Keep this LAST
// ==========================================

router.get("/:category_id", journalController.getJournalsByCategory);

module.exports = router;
