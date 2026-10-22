const httpStatus = require("../../core/http/status");
const catchAsync = require("../../core/http/catchAsync");
const journalService = require("./journal.service");
const mentionsService = require("./mentions.service");
const responseWrapper = require("../../core/http/responseWrapper");
const { identifyAdmin } = require("../../shared/admin");

const createJournal = catchAsync(async (req, res) => {
  const categoryDoc = await journalService.createJournal(req.body, req.files);
  return responseWrapper(
    res,
    categoryDoc,
    "New Journal Created Successfully",
    httpStatus.CREATED,
  );
});

const getJournalsByCategory = catchAsync(async (req, res) => {
  const categorys = await journalService.getJournalsByCategory(
    req.params.category_id,
  );
  return responseWrapper(res, categorys, "");
});

// With any list parameter, one page of article cards (journal.service.js listJournals); without, every published
// article in full, as before.
const LIST_PARAMETERS = ["page", "limit", "category", "search", "exclude", "featured"];

const getAllJournals = catchAsync(async (req, res) => {
  const paged = LIST_PARAMETERS.some((key) => req.query[key] !== undefined);
  const journals = paged ? await journalService.listJournals(req.query) : await journalService.getAllJournals();
  return responseWrapper(res, journals, "");
});

const findJournalById = catchAsync(async (req, res) => {
  const withDrafts = Boolean(await identifyAdmin(req));
  const categoryDoc = await journalService.findJournalById(req.params.id, { withDrafts });
  return responseWrapper(res, categoryDoc, "");
});

const findJournalBySlug = catchAsync(async (req, res) => {
  const withDrafts = Boolean(await identifyAdmin(req));
  const journalDoc = await journalService.findJournalBySlug(req.params.slug, { withDrafts });
  return responseWrapper(res, journalDoc, "");
});

const updateJournal = catchAsync(async (req, res) => {
  const categoryDoc = await journalService.updateJournal(
    req.body,
    req.params.id,
    req.files,
  );
  return responseWrapper(res, categoryDoc, "Journal Update Successfully");
});

const deleteJournal = catchAsync(async (req, res) => {
  await journalService.deleteJournal(req.body);
  return responseWrapper(res, "", "Delete Successfull.", httpStatus.OK);
});

const uploadImage = catchAsync(async (req, res) => {
  const categoryDoc = await journalService.uploadImage(req.files);
  return responseWrapper(
    res,
    categoryDoc,
    "New Journal Created Successfully",
    httpStatus.CREATED,
  );
});

const getAllJournalsByAdmin = catchAsync(async (req, res) => {
  const categorys = await journalService.getAllJournalsByAdmin();
  return responseWrapper(res, categorys, "");
});

const updateJournalSortOrder = catchAsync(async (req, res) => {
  await journalService.updateJournalSortOrder(req.body);

  return responseWrapper(
    res,
    "",
    "Journal order updated successfully.",
    httpStatus.OK,
  );
});

// ==========================
// Mentions: who an article features (admin)
// ==========================

const getArticleMentions = catchAsync(async (req, res) => {
  const data = await mentionsService.adminMentions(req.params.id);
  return responseWrapper(res, data, "");
});

const addArticleMention = catchAsync(async (req, res) => {
  const data = await mentionsService.addMention(req.params.id, req.body);
  return responseWrapper(res, data, "Mention added.");
});

const updateArticleMention = catchAsync(async (req, res) => {
  const data = await mentionsService.updateMention(req.params.id, req.params.mentionId, req.body);
  return responseWrapper(res, data, "Mention updated.");
});

const removeArticleMention = catchAsync(async (req, res) => {
  const data = await mentionsService.removeMention(req.params.id, req.params.mentionId);
  return responseWrapper(res, data, "Mention removed.");
});

// ==========================
// FAQ APIs
// ==========================

const createJournalFaq = catchAsync(async (req, res) => {
  const data = await journalService.createJournalFaq(req.body);

  return responseWrapper(
    res,
    data,
    "FAQ created successfully",
    httpStatus.CREATED,
  );
});

const getAllJournalFaqs = catchAsync(async (req, res) => {
  const data = await journalService.getAllJournalFaqs();

  return responseWrapper(res, data, "");
});

const getJournalFaqById = catchAsync(async (req, res) => {
  const data = await journalService.getJournalFaqById(req.params.id);

  return responseWrapper(res, data, "");
});

const updateJournalFaq = catchAsync(async (req, res) => {
  const data = await journalService.updateJournalFaq(req.params.id, req.body);

  return responseWrapper(res, data, "FAQ updated successfully");
});

const deleteJournalFaq = catchAsync(async (req, res) => {
  await journalService.deleteJournalFaq(req.body);

  return responseWrapper(res, "", "FAQ deleted successfully", httpStatus.OK);
});

// ==========================
// Topic APIs
// ==========================

const createJournalTopic = catchAsync(async (req, res) => {
  const data = await journalService.createJournalTopic(req.body, req.files);

  return responseWrapper(
    res,
    data,
    "Topic created successfully",
    httpStatus.CREATED,
  );
});

const getAllJournalTopics = catchAsync(async (req, res) => {
  const data = await journalService.getAllJournalTopics(req.query);

  return responseWrapper(res, data, "");
});

const getJournalTopicById = catchAsync(async (req, res) => {
  // A public page: professionals' emails only for an admin.
  const isAdmin = Boolean(await identifyAdmin(req));
  const data = await journalService.getJournalTopicById(req.params.id, { withEmails: isAdmin });

  return responseWrapper(res, data, "");
});

const updateJournalTopic = catchAsync(async (req, res) => {
  const data = await journalService.updateJournalTopic(
    req.params.id,
    req.body,
    req.files,
  );

  return responseWrapper(res, data, "Topic updated successfully");
});

const deleteJournalTopic = catchAsync(async (req, res) => {
  await journalService.deleteJournalTopic(req.body);

  return responseWrapper(res, "", "Topic deleted successfully", httpStatus.OK);
});

// ==========================
// Journal FAQ Mapping
// ==========================

const getJournalFaqMappings = catchAsync(async (req, res) => {
  const data = await journalService.getJournalFaqMappings(req.params.id);

  return responseWrapper(res, data, "");
});

const updateJournalFaqMappings = catchAsync(async (req, res) => {
  const data = await journalService.updateJournalFaqMappings(
    req.params.id,
    req.body,
  );

  return responseWrapper(res, data, "Journal FAQs updated successfully");
});

// ==========================
// Journal Topic Mapping
// ==========================

const getJournalTopicMappings = catchAsync(async (req, res) => {
  const data = await journalService.getJournalTopicMappings(req.params.id);

  return responseWrapper(res, data, "");
});

const updateJournalTopicMappings = catchAsync(async (req, res) => {
  const data = await journalService.updateJournalTopicMappings(
    req.params.id,
    req.body,
  );

  return responseWrapper(res, data, "Journal topics updated successfully");
});

// ==========================
// Topic Professionals
// ==========================

const updateJournalTopicProfessionals = catchAsync(async (req, res) => {
  const data = await journalService.updateJournalTopicProfessionals(
    req.params.id,
    req.body,
  );

  return responseWrapper(res, data, "Topic professionals updated successfully");
});

// ==========================
// Topic Products
// ==========================

const updateJournalTopicShops = catchAsync(async (req, res) => {
  const data = await journalService.updateJournalTopicShops(
    req.params.id,
    req.body,
  );

  return responseWrapper(res, data, "Topic products updated successfully");
});

// ==========================
// Topic Podcasts
// ==========================

const updateJournalTopicPodcasts = catchAsync(async (req, res) => {
  const data = await journalService.updateJournalTopicPodcasts(
    req.params.id,
    req.body,
  );

  return responseWrapper(res, data, "Topic podcasts updated successfully");
});

// ==========================
// Topic Paragraphs
// ==========================

const getJournalTopicParagraphs = catchAsync(async (req, res) => {
  const data = await journalService.getJournalTopicParagraphs(req.params.id);

  return responseWrapper(res, data, "");
});

const updateJournalTopicParagraphs = catchAsync(async (req, res) => {
  const data = await journalService.updateJournalTopicParagraphs(
    req.params.id,
    req.body,
  );

  return responseWrapper(res, data, "Topic paragraphs updated successfully");
});

module.exports = {
  getArticleMentions,
  addArticleMention,
  updateArticleMention,
  removeArticleMention,
  createJournal,
  getJournalsByCategory,
  getAllJournals,
  findJournalById,
  findJournalBySlug,
  updateJournal,
  deleteJournal,
  uploadImage,
  getAllJournalsByAdmin,
  updateJournalSortOrder,

  // FAQ
  createJournalFaq,
  getAllJournalFaqs,
  getJournalFaqById,
  updateJournalFaq,
  deleteJournalFaq,

  // Topic
  createJournalTopic,
  getAllJournalTopics,
  getJournalTopicById,
  updateJournalTopic,
  deleteJournalTopic,

  // FAQ Mapping
  getJournalFaqMappings,
  updateJournalFaqMappings,

  // Topic Mapping
  getJournalTopicMappings,
  updateJournalTopicMappings,

  // Topic Professionals
  updateJournalTopicProfessionals,

  // Topic Products
  updateJournalTopicShops,

  // Topic Podcasts
  updateJournalTopicPodcasts,

  // Topic Paragraphs
  getJournalTopicParagraphs,
  updateJournalTopicParagraphs,
};
