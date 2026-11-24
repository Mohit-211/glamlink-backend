const httpStatus = require("../../core/http/status");
const { Op, literal } = require("sequelize");
const { paging, idList } = require("../../core/http/paging");
const { containing } = require("../../core/utils/like");
const { matchFirst } = require("../../core/db/searchOrder");
const { isUploadedImage } = require("../../core/http/uploadedFiles");
const { isYes, wholeNumber } = require("../../core/utils/formValues");
const { toSlug } = require("../../core/utils/slug");
const { freeSlug, slugTaken } = require("../../core/db/freeSlug");
const { indexMentions, mentionsOf, articleIdsFeaturing } = require("./mentions.service");
const { videosOfTopic } = require("../watch");
const { pageCards } = require("../profiles");
const { toPublicCard, withoutOffers } = require("../access-card");
const sequelize = require("../../core/db/central.db");
const topicItems = require("./topicItems.service");
const {
  Journal,
  Author,
  JournalCategory,
  JournalDownload,
  JournalShop,
  Shop,
  JournalTopic,
  JournalFaq,
  JournalFaqMapping,
  JournalTopicMapping,
  JournalTopicParagraphMapping,
  PodcastSchedule,
  User,
  JournalTopicProductMapping,
  JournalTopicPodcastMapping,
  BusinessGalleryMedia,
  BusinessLocation,
  BusinessCard,
  Profile,
  BusinessHour,
} = require("../../models");
const ApiError = require("../../core/http/ApiError");

const given = (value) => value !== undefined && value !== null && String(value).trim() !== "";
const refuseSlug = (message) => ApiError.withCode(httpStatus.BAD_REQUEST, message, "INVALID_INPUT", { field: "slug" });

// An article's slug: the one an admin gives, written as a slug ("My Post" is my-post) and refused when another
// article has it; else one made from the title. `id`: the article being edited.
const articleSlug = async (value, title, id = null) => {
  if (!given(value)) return freeSlug(Journal, title, { id, fallback: "article" });
  const slug = toSlug(value).slice(0, 150);
  if (slug.length < 2) throw refuseSlug("slug is at least 2 letters, digits and dashes.");
  if (await slugTaken(Journal, slug, id)) throw refuseSlug("This slug is taken.");
  return slug;
};

// An article's topics, in its order (A-CNT-1, Nov 24): links to topics it no longer lists are deleted for good, new
// ones are added (a link deleted softly before comes back: the unique key counts deleted rows, which made every such
// save answer 500 and leave the article with no topics), and every link takes the article's order. One transaction.
const setArticleTopics = (journalId, topicIds) =>
  sequelize.transaction(async (transaction) => {
    await sequelize.query(
      `DELETE FROM journal_topic_mappings WHERE journal_id = :journalId${topicIds.length ? " AND topic_id NOT IN (:topicIds)" : ""}`,
      { replacements: { journalId, topicIds }, transaction },
    );
    for (const [index, topicId] of topicIds.entries()) {
      await sequelize.query(
        `INSERT INTO journal_topic_mappings (journal_id, topic_id, sort_order) VALUES (:journalId, :topicId, :order)
         ON DUPLICATE KEY UPDATE deleted_at = NULL, sort_order = :order`,
        { replacements: { journalId, topicId, order: index + 1 }, transaction },
      );
    }
  });

const createJournal = async (reqBody, files) => {
  const isPublished = reqBody.status === "published";

  const journalObj = {
    title: reqBody.title,
    author_id: reqBody.author_id,
    category_id: reqBody.category_id || null,
    short_description: reqBody.short_description,
    status: isPublished ? "published" : "draft",
    is_featured: isYes(reqBody.is_featured),
    publish_date: reqBody.publish_date || null,
    content: reqBody.content,

    seo_title: reqBody.seo_title || null,
    meta_description: reqBody.meta_description || null,
    slug: await articleSlug(reqBody.slug, reqBody.title),
    created_at: new Date(),
  };

  // ==========================
  // Cover Image
  // ==========================
  if (files?.images?.length) {
    journalObj.cover_image = files.images[0].filename;
  }

  // ==========================
  // Create Journal
  // ==========================
  const journalDoc = await Journal.create(journalObj);

  // ==========================
  // Save Journal FAQ Mappings
  // ==========================
  const faqIds = parseIds(reqBody.faq_ids);

  if (faqIds.length) {
    const faqs = await JournalFaq.findAll({
      where: {
        id: faqIds,
        is_active: true,
      },
      attributes: ["id"],
    });

    const validFaqIds = faqs.map((faq) => Number(faq.id));

    if (validFaqIds.length !== faqIds.length) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "One or more FAQ IDs are invalid",
      );
    }

    await JournalFaqMapping.bulkCreate(
      faqIds.map((faqId, index) => ({
        journal_id: journalDoc.id,
        faq_id: faqId,
        sort_order: index + 1,
      })),
    );
  }

  // ==========================
  // Save Journal Topic Mappings
  // ==========================
  const topicIds = parseIds(reqBody.topic_ids);

  if (topicIds.length) {
    const topics = await JournalTopic.findAll({
      where: {
        id: topicIds,
        is_active: true,
      },
      attributes: ["id"],
    });

    const validTopicIds = topics.map((topic) => Number(topic.id));

    if (validTopicIds.length !== topicIds.length) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "One or more Topic IDs are invalid",
      );
    }

    await JournalTopicMapping.bulkCreate(
      topicIds.map((topicId, index) => ({
        journal_id: journalDoc.id,
        topic_id: topicId,
        sort_order: index + 1,
      })),
    );
  }

  if (!journalDoc) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to create new Journal",
    );
  }

  // ==========================
  // Save Journal Shops
  // ==========================
  let shopIds = reqBody.shop_ids || [];

  if (typeof shopIds === "string") {
    try {
      shopIds = JSON.parse(shopIds);
    } catch (error) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Invalid shop_ids format");
    }
  }

  // In case frontend sends one ID instead of an array
  if (!Array.isArray(shopIds)) {
    shopIds = [shopIds];
  }

  shopIds = shopIds
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (shopIds.length) {
    // Only use active shops that actually exist
    const shops = await Shop.findAll({
      where: {
        id: shopIds,
        is_active: true,
      },
      attributes: ["id"],
    });

    const journalShopData = shops.map((shop) => ({
      journal_id: journalDoc.id,
      shop_id: shop.id,
    }));

    if (journalShopData.length) {
      await JournalShop.bulkCreate(journalShopData);
    }
  }

  // ==========================
  // Save Journal Downloads
  // ==========================
  if (files?.docs?.length) {
    const titles = Array.isArray(reqBody.download_titles)
      ? reqBody.download_titles
      : reqBody.download_titles
        ? [reqBody.download_titles]
        : [];

    const descriptions = Array.isArray(reqBody.download_descriptions)
      ? reqBody.download_descriptions
      : reqBody.download_descriptions
        ? [reqBody.download_descriptions]
        : [];

    const buttonTexts = Array.isArray(reqBody.download_button_text)
      ? reqBody.download_button_text
      : reqBody.download_button_text
        ? [reqBody.download_button_text]
        : [];

    const downloadData = files.docs.map((file, index) => ({
      journal_id: journalDoc.id,
      title: titles[index] || `Download ${index + 1}`,
      description: descriptions[index] || null,
      button_text: buttonTexts[index] || "Download PDF",
      file_name: file.filename,
      sort_order: index + 1,
    }));

    await JournalDownload.bulkCreate(downloadData);
  }

  // Who it features; the editor sees the @handles that match no one.
  journalDoc.dataValues.unmatched_mentions = await indexMentions(journalDoc.id, journalDoc.content);

  return journalDoc;
};

const getJournalsByCategory = async (category_id) => {
  if (!category_id) {
    throw new ApiError(httpStatus.BAD_REQUEST, "category_id is required");
  }

  const journalDoc = await Journal.findAndCountAll({
    where: {
      is_active: true,
      status: "published",
      category_id: category_id,
    },
    // Count articles, not the rows their downloads and products multiply them into.
    distinct: true,
    include: [
      {
        model: Author,
        as: "journal_author",
        attributes: ["id", "name", "profile_image"],
      },
      {
        model: JournalCategory,
        as: "journal_category",
        attributes: ["id", "title", "slug"],
      },
      {
        model: JournalDownload,
        as: "downloads",
        required: false,
        where: {
          is_active: true,
        },
        attributes: [
          "id",
          "title",
          "description",
          "file_name",
          "button_text",
          "sort_order",
        ],
      },
      {
        model: Shop,
        as: "shops",
        through: {
          attributes: [],
        },
        required: false,
        where: {
          is_active: true,
        },
      },
    ],
    order: [
      ["sort_order", "ASC"],
      [{ model: JournalDownload, as: "downloads" }, "sort_order", "ASC"],
    ],
  });

  if (!journalDoc) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to get Journals by category",
    );
  }

  return journalDoc;
};

// What a list shows of an article: the Journal grid and hero, the home page's latest articles, related articles,
// the sitemap. No body, products or downloads.
const CARD_ATTRIBUTES = ["id", "slug", "title", "short_description", "cover_image", "publish_date", "is_featured", "created_at", "updated_at"];

// Newest first: by publish date, or by the date it was written when it has none.
const NEWEST_FIRST = [[literal("COALESCE(`Journal`.`publish_date`, `Journal`.`created_at`)"), "DESC"], ["id", "DESC"]];

// A category by its slug (pro-spotlight) or its id.
const findCategory = (value) =>
  JournalCategory.findOne({
    where: /^\d+$/.test(String(value)) ? { id: value, is_active: true } : { slug: String(value).trim(), is_active: true },
    attributes: ["id"],
  });

// GET /journal with list parameters: one page of published articles as cards, newest first.
//   category  a category slug (or id); search  title, short description, category and author name;
//   exclude  ids to leave out ("12,15"); featured=true  only featured articles; page, limit (12, at most 50).
//   rank (search results): titles matching the search exactly first, then those starting with it.
const listJournals = async (query = {}, { rank = false } = {}) => {
  const { limit, offset } = paging(query);
  const where = { is_active: true, status: "published" };

  if (isYes(query.featured)) where.is_featured = true;

  const exclude = idList(query.exclude);
  if (exclude.length) where.id = { [Op.notIn]: exclude };

  if (query.category) {
    const category = await findCategory(query.category);
    if (!category) return { count: 0, rows: [] };
    where.category_id = category.id;
  }

  const search = String(query.search ?? "").trim();
  if (search) {
    const term = containing(search);
    where[Op.or] = [
      { title: { [Op.like]: term } },
      { short_description: { [Op.like]: term } },
      { "$journal_category.title$": { [Op.like]: term } },
      { "$journal_author.name$": { [Op.like]: term } },
    ];
  }

  return Journal.findAndCountAll({
    attributes: CARD_ATTRIBUTES,
    where,
    include: [
      { model: Author, as: "journal_author", attributes: ["id", "name", "profile_image"] },
      { model: JournalCategory, as: "journal_category", attributes: ["id", "title", "slug"] },
    ],
    order: rank && search ? [...matchFirst("`Journal`.`title`", search), ...NEWEST_FIRST] : NEWEST_FIRST,
    limit,
    offset,
    distinct: true,
  });
};

// Topics whose name matches the search, exact matches first (the site-wide search): light rows.
const searchTopics = async ({ q, limit, offset }) => {
  const term = containing(q);
  const { count, rows } = await JournalTopic.findAndCountAll({
    attributes: ["id", "name", "slug", "cover_image", "tile_image"],
    where: { is_active: true, [Op.or]: [{ name: { [Op.like]: term } }, { slug: { [Op.like]: term } }] },
    order: [...matchFirst("`JournalTopic`.`name`", q), ["name", "ASC"]],
    limit,
    offset,
  });
  return { count, rows };
};

// The published articles that feature an account (GET /profiles/:slug and /profiles/:slug/articles), as cards,
// newest first.
const articlesOfAccount = async (userId, query = {}) => {
  const ids = await articleIdsFeaturing(userId);
  if (!ids.length) return { count: 0, rows: [] };
  const { limit, offset } = paging(query);
  return Journal.findAndCountAll({
    attributes: CARD_ATTRIBUTES,
    where: { id: ids, is_active: true, status: "published" },
    include: [
      { model: Author, as: "journal_author", attributes: ["id", "name", "profile_image"] },
      { model: JournalCategory, as: "journal_category", attributes: ["id", "title", "slug"] },
    ],
    order: NEWEST_FIRST,
    limit,
    offset,
    distinct: true,
  });
};

const getAllJournals = async () => {
  const journalDoc = await Journal.findAndCountAll({
    where: {
      is_active: true,
      status: "published",
    },
    // Count articles, not the rows their downloads and products multiply them into.
    distinct: true,
    include: [
      {
        model: Author,
        as: "journal_author",
        attributes: ["id", "name", "profile_image"],
      },
      {
        model: JournalCategory,
        as: "journal_category",
        attributes: ["id", "title", "slug"],
      },
      {
        model: JournalDownload,
        as: "downloads",
        required: false,
        where: {
          is_active: true,
        },
        attributes: [
          "id",
          "title",
          "description",
          "file_name",
          "button_text",
          "sort_order",
        ],
      },
      {
        model: Shop,
        as: "shops",
        through: {
          attributes: [],
        },
        required: false,
        where: {
          is_active: true,
        },
      },
    ],
    order: [
      ["sort_order", "ASC"],
      [{ model: JournalDownload, as: "downloads" }, "sort_order", "ASC"],
    ],
  });

  if (!journalDoc) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to get all Journals",
    );
  }

  return journalDoc;
};

// One article in full, with who it features. Drafts only for admins (the admin panel edits them); anyone else gets
// published articles.
const findJournal = async (where, { withDrafts = false } = {}) => {
  const journalDoc = await Journal.findOne({
    where: {
      ...where,
      is_active: true,
      ...(!withDrafts && { status: "published" }),
    },
    include: [
      {
        model: Author,
        as: "journal_author",
        attributes: ["id", "name", "profile_image"],
      },
      {
        model: JournalCategory,
        as: "journal_category",
        attributes: ["id", "title", "slug"],
      },
      {
        model: JournalDownload,
        as: "downloads",
        where: {
          is_active: true,
        },
        required: false,
        attributes: [
          "id",
          "title",
          "description",
          "file_name",
          "button_text",
          "sort_order",
        ],
      },
      {
        model: Shop,
        as: "shops",
        through: {
          attributes: [],
        },
        required: false,
        where: {
          is_active: true,
        },
      },

      {
        model: JournalFaq,
        as: "faqs",
        through: {
          attributes: ["sort_order"],
        },
        required: false,
        where: {
          is_active: true,
        },
        attributes: ["id", "question", "answer"],
      },
      {
        model: JournalTopic,
        as: "topics",
        through: {
          attributes: ["sort_order"],
        },
        required: false,
        where: {
          is_active: true,
        },
        attributes: ["id", "name", "slug"],
      },
    ],
    order: [
      [{ model: JournalDownload, as: "downloads" }, "sort_order", "ASC"],
    ],
  });
  if (!journalDoc) return null;

  // The people it features, linked to their pages.
  journalDoc.dataValues.mentions = await mentionsOf(journalDoc.id);
  return journalDoc;
};

// The sitemap's articles and topics: every published article's and every topic's id, slug and date of last change.
const SITEMAP_ROW = ["id", "slug", "updated_at"];
const sitemapArticles = () =>
  Journal.findAll({ attributes: SITEMAP_ROW, where: { is_active: true, status: "published" }, order: [["id", "ASC"]], raw: true });
const sitemapTopics = () =>
  JournalTopic.findAll({ attributes: SITEMAP_ROW, where: { is_active: true }, order: [["id", "ASC"]], raw: true });

// GET /journal/findJournalById/:id answers as it always has, "No Journal Found" for a missing article.
const findJournalById = async (id, options) => (await findJournal({ id }, options)) ?? "No Journal Found";

// GET /journal/slug/:slug: the article by its slug (old links by id keep working); 404 when there is none.
const findJournalBySlug = async (slug, options) => {
  const journalDoc = await findJournal({ slug: String(slug) }, options);
  if (!journalDoc) throw ApiError.withCode(httpStatus.NOT_FOUND, "Article not found.", "NOT_FOUND");
  return journalDoc;
};

const updateJournal = async (reqBody, id, files) => {
  const journalDoc = await Journal.findByPk(id);

  if (!journalDoc) {
    throw new ApiError(httpStatus.NOT_FOUND, "Journal not found");
  }

  // ==========================
  // Update Journal Details
  // ==========================
  if (reqBody.title && reqBody.title !== "") {
    journalDoc.title = reqBody.title;
  }

  if (reqBody.author_id) {
    journalDoc.author_id = reqBody.author_id;
  }

  if (reqBody.category_id) {
    journalDoc.category_id = reqBody.category_id;
  }

  if (reqBody.short_description) {
    journalDoc.short_description = reqBody.short_description;
  }

  if (reqBody.content) {
    journalDoc.content = reqBody.content;
  }

  if (reqBody.publish_date) {
    journalDoc.publish_date = reqBody.publish_date;
  }

  if (reqBody.status) {
    journalDoc.status = reqBody.status;
  }

  if (reqBody.is_featured !== undefined) {
    journalDoc.is_featured = isYes(reqBody.is_featured);
  }

  if (reqBody.seo_title !== undefined) {
    journalDoc.seo_title = reqBody.seo_title || null;
  }

  if (reqBody.meta_description !== undefined) {
    journalDoc.meta_description = reqBody.meta_description || null;
  }

  // An article keeps its slug (its links) unless an admin gives another; an empty one changes nothing.
  if (given(reqBody.slug)) {
    journalDoc.slug = await articleSlug(reqBody.slug, journalDoc.title, journalDoc.id);
  }

  if (files?.images?.length) {
    journalDoc.cover_image = files.images[0].filename;
  }

  await journalDoc.save();

  // ==========================
  // Update FAQ Mappings
  // ==========================
  if (reqBody.faq_ids !== undefined) {
    const faqIds = parseIds(reqBody.faq_ids);

    if (faqIds.length) {
      const faqs = await JournalFaq.findAll({
        where: {
          id: faqIds,
          is_active: true,
        },
        attributes: ["id"],
      });

      if (faqs.length !== faqIds.length) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "One or more FAQ IDs are invalid",
        );
      }
    }

    await JournalFaqMapping.destroy({
      where: {
        journal_id: id,
      },
    });

    if (faqIds.length) {
      await JournalFaqMapping.bulkCreate(
        faqIds.map((faqId, index) => ({
          journal_id: id,
          faq_id: faqId,
          sort_order: index + 1,
        })),
      );
    }
  }

  // ==========================
  // Update Topic Mappings
  // ==========================
  if (reqBody.topic_ids !== undefined) {
    const topicIds = parseIds(reqBody.topic_ids);

    if (topicIds.length) {
      const topics = await JournalTopic.findAll({
        where: {
          id: topicIds,
          is_active: true,
        },
        attributes: ["id"],
      });

      if (topics.length !== topicIds.length) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "One or more Topic IDs are invalid",
        );
      }
    }

    await setArticleTopics(id, topicIds);
  }

  // ==========================
  // Update Journal Shops
  // ==========================
  if (reqBody.shop_ids !== undefined) {
    let shopIds = reqBody.shop_ids;

    if (typeof shopIds === "string") {
      try {
        shopIds = JSON.parse(shopIds);
      } catch (error) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Invalid shop_ids format");
      }
    }

    if (!Array.isArray(shopIds)) {
      shopIds = [shopIds];
    }

    shopIds = shopIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    // Remove all current relationships
    await JournalShop.destroy({
      where: {
        journal_id: journalDoc.id,
      },
    });

    // Add the newly selected shops
    if (shopIds.length) {
      const shops = await Shop.findAll({
        where: {
          id: shopIds,
          is_active: true,
        },
        attributes: ["id"],
      });

      const journalShopData = shops.map((shop) => ({
        journal_id: journalDoc.id,
        shop_id: shop.id,
      }));

      if (journalShopData.length) {
        await JournalShop.bulkCreate(journalShopData);
      }
    }
  }

  // ==========================
  // Update Existing Downloads
  // ==========================
  let existingDownloads = reqBody.existing_downloads || [];

  if (typeof existingDownloads === "string") {
    try {
      existingDownloads = JSON.parse(existingDownloads);
    } catch (error) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Invalid existing_downloads format",
      );
    }
  }

  if (Array.isArray(existingDownloads) && existingDownloads.length) {
    for (const item of existingDownloads) {
      await JournalDownload.update(
        {
          title: item.title,
          description: item.description || null,
          button_text: item.button_text || "Download PDF",
          sort_order: item.sort_order || 0,
        },
        {
          where: {
            id: item.id,
            journal_id: id,
            is_active: true,
          },
        },
      );
    }
  }

  // ==========================
  // Delete Removed Downloads
  // ==========================
  let deletedDownloadIds = reqBody.deleted_download_ids || [];

  if (typeof deletedDownloadIds === "string") {
    try {
      deletedDownloadIds = JSON.parse(deletedDownloadIds);
    } catch (error) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Invalid deleted_download_ids format",
      );
    }
  }

  if (Array.isArray(deletedDownloadIds) && deletedDownloadIds.length) {
    const downloads = await JournalDownload.findAll({
      where: {
        id: deletedDownloadIds,
        journal_id: id,
        is_active: true,
      },
    });

    await Promise.all(
      downloads.map(async (download) => {
        download.is_active = false;
        await download.save();
        await download.destroy();
      }),
    );
  }

  // ==========================
  // Add New Downloads
  // ==========================
  if (files?.docs?.length) {
    const titles = Array.isArray(reqBody.download_titles)
      ? reqBody.download_titles
      : reqBody.download_titles
        ? [reqBody.download_titles]
        : [];

    const descriptions = Array.isArray(reqBody.download_descriptions)
      ? reqBody.download_descriptions
      : reqBody.download_descriptions
        ? [reqBody.download_descriptions]
        : [];

    const buttonTexts = Array.isArray(reqBody.download_button_text)
      ? reqBody.download_button_text
      : reqBody.download_button_text
        ? [reqBody.download_button_text]
        : [];

    const maxSortOrder = await JournalDownload.max("sort_order", {
      where: {
        journal_id: id,
        is_active: true,
      },
    });

    const startSortOrder = (maxSortOrder || 0) + 1;

    const downloadData = files.docs.map((file, index) => ({
      journal_id: id,
      title: titles[index] || `Download ${index + 1}`,
      description: descriptions[index] || null,
      button_text: buttonTexts[index] || "Download PDF",
      file_name: file.filename,
      sort_order: startSortOrder + index,
    }));

    await JournalDownload.bulkCreate(downloadData);
  }

  // Who it features; the editor sees the @handles that match no one.
  journalDoc.dataValues.unmatched_mentions = await indexMentions(journalDoc.id, journalDoc.content);

  return journalDoc;
};

const deleteJournal = async (body) => {
  if (!Array.isArray(body.journal_id) || body.journal_id.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid journal_id");
  }

  const journalIds = body.journal_id.map((id) => Number(id)).filter(Boolean);

  if (journalIds.length === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "No valid journal IDs provided",
    );
  }

  const journals = await Journal.findAll({
    where: {
      id: journalIds,
      is_active: true,
    },
  });

  if (!journals.length) {
    throw new ApiError(httpStatus.NOT_FOUND, "No journals found");
  }

  await Promise.all(
    journals.map(async (journal) => {
      // Soft delete all journal downloads
      const downloads = await JournalDownload.findAll({
        where: {
          journal_id: journal.id,
          is_active: true,
        },
      });

      await Promise.all(
        downloads.map(async (download) => {
          download.is_active = false;
          await download.save();
          await download.destroy();
        }),
      );

      // Soft delete journal
      journal.is_active = false;
      await journal.save();
      await journal.destroy();
    }),
  );

  return true;
};

const updateJournalSortOrder = async (body) => {
  const { journals } = body;

  if (!Array.isArray(journals) || journals.length === 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid journals array");
  }

  await Promise.all(
    journals.map((item, index) =>
      Journal.update(
        {
          sort_order: index + 1,
        },
        {
          where: {
            id: item.id,
            is_active: true,
          },
        },
      ),
    ),
  );

  return true;
};

const uploadImage = async (files) => {
  if (!files || !files.images || !files.images.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, "No image uploaded");
  }

  // Multer already converted filename to full public URL
  const imageUrl = files.images[0].filename;

  return {
    location: imageUrl, // 🔥 TinyMCE requires "location"
  };
};

const getAllJournalsByAdmin = async () => {
  const journalDoc = await Journal.findAndCountAll({
    where: {
      is_active: true,
    },
    include: [
      {
        model: Author,
        as: "journal_author",
        attributes: ["id", "name", "profile_image"],
      },
      {
        model: JournalCategory,
        as: "journal_category",
        attributes: ["id", "title", "slug"],
      },
      {
        model: JournalDownload,
        as: "downloads",
        required: false,
        where: {
          is_active: true,
        },
        attributes: [
          "id",
          "title",
          "description",
          "file_name",
          "button_text",
          "sort_order",
        ],
      },
      {
        model: Shop,
        as: "shops",
        through: {
          attributes: [],
        },
        required: false,
        where: {
          is_active: true,
        },
      },
    ],
    order: [
      ["sort_order", "ASC"],
      [{ model: JournalDownload, as: "downloads" }, "sort_order", "ASC"],
    ],
  });

  if (!journalDoc) {
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      "Failed to get all Journals",
    );
  }

  return journalDoc;
};

const parseIds = (value) => {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch (error) {
      value = [value];
    }
  }

  if (!Array.isArray(value)) {
    value = [value];
  }

  return value
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
};

const createJournalFaq = async (body) => {
  const { question, answer } = body;

  if (!question || !question.trim()) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Question is required");
  }

  if (!answer || !answer.trim()) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Answer is required");
  }

  const faq = await JournalFaq.create({
    question: question.trim(),
    answer: answer.trim(),
    is_active: true,
  });

  return faq;
};

const getAllJournalFaqs = async () => {
  const faqs = await JournalFaq.findAll({
    where: {
      is_active: true,
    },
    order: [["id", "DESC"]],
  });

  return faqs;
};

const getJournalFaqById = async (id) => {
  const faq = await JournalFaq.findOne({
    where: {
      id,
      is_active: true,
    },
  });

  if (!faq) {
    throw new ApiError(httpStatus.NOT_FOUND, "FAQ not found");
  }

  return faq;
};

const updateJournalFaq = async (id, body) => {
  const faq = await JournalFaq.findOne({
    where: {
      id,
      is_active: true,
    },
  });

  if (!faq) {
    throw new ApiError(httpStatus.NOT_FOUND, "FAQ not found");
  }

  if (body.question !== undefined) {
    if (!body.question.trim()) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Question cannot be empty");
    }

    faq.question = body.question.trim();
  }

  if (body.answer !== undefined) {
    if (!body.answer.trim()) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Answer cannot be empty");
    }

    faq.answer = body.answer.trim();
  }

  await faq.save();

  return faq;
};

const deleteJournalFaq = async (body) => {
  const faqIds = parseIds(body.faq_id);

  if (!faqIds.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid faq_id");
  }

  const faqs = await JournalFaq.findAll({
    where: {
      id: faqIds,
      is_active: true,
    },
  });

  if (!faqs.length) {
    throw new ApiError(httpStatus.NOT_FOUND, "No FAQs found");
  }

  await JournalFaq.update(
    {
      is_active: false,
    },
    {
      where: {
        id: faqIds,
      },
    },
  );

  return true;
};

// ==========================
// Topic CRUD
// ==========================

// The home page tile fields an admin may send with a topic: is_featured, featured_order (whole number) and
// tile_image (a link from POST /journal/upload, or empty to remove it).
const topicTileFields = (body) => {
  const fields = {};
  if (body.is_featured !== undefined) fields.is_featured = isYes(body.is_featured);
  if (body.featured_order !== undefined && body.featured_order !== "") {
    const order = wholeNumber(body.featured_order);
    if (order === null) {
      throw new ApiError(httpStatus.BAD_REQUEST, "featured_order must be a whole number");
    }
    fields.featured_order = order;
  }
  if (body.tile_image !== undefined) {
    if (body.tile_image === null || body.tile_image === "") {
      fields.tile_image = null;
    } else if (isUploadedImage(body.tile_image)) {
      fields.tile_image = body.tile_image;
    } else {
      throw new ApiError(httpStatus.BAD_REQUEST, "tile_image must be an image uploaded to the API (POST /journal/upload)");
    }
  }
  return fields;
};

const createJournalTopic = async (body, files) => {
  const { name, slug, description } = body;

  // ==========================
  // Validate Name
  // ==========================
  if (!name || !name.trim()) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Topic name is required");
  }

  const cleanName = name.trim();

  // ==========================
  // Generate / Normalize Slug
  // ==========================
  const cleanSlug = slug
    ? slug
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    : cleanName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

  if (!cleanSlug) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid topic slug");
  }

  // ==========================
  // Check Duplicate Slug
  // ==========================
  const existingTopic = await JournalTopic.findOne({
    where: {
      slug: cleanSlug,
    },
  });

  if (existingTopic) {
    // Restore inactive topic
    if (!existingTopic.is_active) {
      const updateData = {
        name: cleanName,
        slug: cleanSlug,
        description: description || null,
        is_active: true,
        ...topicTileFields(body),
      };

      // ==========================
      // Topic Image
      // ==========================
      if (files?.images?.length) {
        updateData.cover_image = files.images[0].filename;
      }

      await existingTopic.update(updateData);

      return existingTopic;
    }

    throw new ApiError(httpStatus.BAD_REQUEST, "Topic already exists");
  }

  // ==========================
  // Create Topic
  // ==========================
  const topicData = {
    name: cleanName,
    slug: cleanSlug,
    description: description || null,
    is_active: true,
    ...topicTileFields(body),
  };

  // ==========================
  // Topic Image
  // ==========================
  if (files?.images?.length) {
    topicData.cover_image = files.images[0].filename;
  }

  const topic = await JournalTopic.create(topicData);

  return topic;
};

// Every active topic by name; with featured=true, the home page's tiles in their order.
const getAllJournalTopics = async (query = {}) => {
  const { search = "" } = query;
  const featured = isYes(query.featured);

  const where = {
    is_active: true,
    ...(featured && { is_featured: true }),
  };

  // ==========================
  // Search
  // ==========================
  if (search && search.trim()) {
    const searchValue = `%${search.trim()}%`;

    where[Op.or] = [
      {
        name: {
          [Op.like]: searchValue,
        },
      },
      {
        slug: {
          [Op.like]: searchValue,
        },
      },
      {
        description: {
          [Op.like]: searchValue,
        },
      },
    ];
  }

  const topics = await JournalTopic.findAll({
    where,
    order: featured ? [["featured_order", "ASC"], ["name", "ASC"]] : [["name", "ASC"]],
  });

  return topics;
};

// Newest first: an article's publish date, else when it was made.
const articleDate = (article) => new Date(article.publish_date || article.created_at || 0).getTime();
// A link's place in the topic's order (a row from a belongsToMany include, with its link model's fields).
const linkOrder = (through) => (row) => Number(row[through]?.sort_order ?? 0);

// A topic's professionals and brands (one link table), in the topic's order. The public gets the pages that show (Nov
// 24, W-1): each professional's live card only as anyone may see it (cardPublic: no plan, account, subscription or
// hidden phone), with the page's slug; brands as the Brands page lists them. Admins get every linked account, the
// professionals' emails, and their active cards whole.
const topicPeople = async (topicId, { admin = false } = {}) => {
  const [links] = await sequelize.query(
    `SELECT m.user_id, COALESCE(u.professional_type, 'individual') AS type FROM journal_topic_professional_mappings m
     JOIN users u ON u.id = m.user_id AND u.account_type = 'professional' AND u.is_active = 1 AND u.deleted_at IS NULL
     WHERE m.topic_id = :topicId AND m.deleted_at IS NULL ORDER BY m.sort_order ASC, m.id ASC`,
    { replacements: { topicId } },
  );
  const ids = [...new Set(links.map((link) => Number(link.user_id)))];
  const pages = await pageCards(ids, { hidden: admin });
  const typed = (type) => ids.filter((id) => pages.has(id) && links.find((link) => Number(link.user_id) === id).type === type);
  const individuals = typed("individual");
  const brands = typed("brand").map((id) => pages.get(id));
  if (!individuals.length) return { professionals: [], brands };

  const users = await User.unscoped().findAll({
    where: { id: individuals },
    attributes: admin ? ["id", "email"] : ["id"],
    include: [
      { model: Profile, as: "user_profile", attributes: ["name"], required: false },
      {
        model: BusinessCard,
        as: "user_business_cards",
        where: { is_active: true, ...(admin ? {} : { status: "accepted" }) },
        required: false,
        include: [
          { model: BusinessLocation, as: "locations" },
          { model: BusinessGalleryMedia, as: "images" },
          { model: BusinessHour, as: "business_hour" },
          ...(admin
            ? [{ model: User, as: "business_user", required: false, attributes: ["id", "subscription_status", "subscription_started_at", "subscription_renewal_at"] }]
            : []),
        ],
      },
    ],
  });
  const byId = new Map(users.map((user) => [Number(user.id), user.toJSON()]));
  const professionals = individuals.filter((id) => byId.has(id)).map((id) => {
    const user = byId.get(id);
    const cards = Array.isArray(user.user_business_cards) ? user.user_business_cards : [];
    // The account's newest live (for admins: active) card.
    const card = cards.toSorted((a, b) => Number(b.id) - Number(a.id))[0] ?? null;
    return {
      id,
      ...(admin && { email: user.email }),
      name: user.user_profile?.name || pages.get(id).name || null,
      slug: pages.get(id).slug,
      business_card: card ? (admin ? withoutOffers(card) : toPublicCard(card)) : null,
    };
  });
  return { professionals, brands };
};

// A topic's page (GET /journal/topic/:id, by its id or slug). For the public (Nov 24: W-1, A-CNT-3): only published
// articles and products, and the professionals and brands whose pages show; for admins (`admin`) drafts and hidden pages
// too, with the professionals' emails. Articles and videos come newest first; professionals, brands and products in the
// topic's order. Since Nov 24 the topic has `brands` (rows as GET /profiles answers them).
const getJournalTopicById = async (id, { admin = false } = {}) => {
  const shown = admin ? {} : { status: "published" };
  const topic = await JournalTopic.findOne({
    where: {
      ...(/^\d+$/.test(String(id)) ? { id } : { slug: String(id) }),
      is_active: true,
    },
    include: [
      {
        model: Journal,
        as: "journals",
        through: { attributes: ["sort_order"], where: { deleted_at: null } },
        where: { is_active: true, ...shown },
        required: false,
        include: [
          { model: Author, as: "journal_author", attributes: ["id", "name", "profile_image"] },
          { model: JournalCategory, as: "journal_category", attributes: ["id", "title", "slug"] },
        ],
      },
      {
        model: Shop,
        as: "shops",
        through: { attributes: ["sort_order"], where: { deleted_at: null } },
        where: { is_active: true, ...shown },
        required: false,
      },
      {
        model: PodcastSchedule,
        as: "podcasts",
        through: { attributes: ["sort_order"] },
        required: false,
      },
    ],
  });

  if (!topic) {
    throw new ApiError(httpStatus.NOT_FOUND, "Topic not found");
  }

  const data = topic.toJSON();
  data.journals = (data.journals || []).toSorted((a, b) => articleDate(b) - articleDate(a) || Number(b.id) - Number(a.id));
  data.shops = (data.shops || []).toSorted((a, b) => linkOrder("JournalTopicProductMapping")(a) - linkOrder("JournalTopicProductMapping")(b));
  Object.assign(data, await topicPeople(topic.id, { admin }));

  // Its videos (website/watch), newest first.
  data.videos = await videosOfTopic(topic.id);

  return data;
};

const updateJournalTopic = async (id, body, files) => {
  const topic = await JournalTopic.findOne({
    where: {
      id,
      is_active: true,
    },
  });

  if (!topic) {
    throw new ApiError(httpStatus.NOT_FOUND, "Topic not found");
  }

  const updateData = {};

  // ==========================
  // Name
  // ==========================
  if (body.name !== undefined) {
    if (!body.name || !body.name.trim()) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Topic name cannot be empty",
      );
    }

    updateData.name = body.name.trim();

    // If slug is not explicitly provided,
    // regenerate slug from name
    if (body.slug === undefined) {
      updateData.slug = body.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }
  }

  // ==========================
  // Slug
  // ==========================
  if (body.slug !== undefined) {
    const cleanSlug = body.slug
      ? body.slug
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
      : null;

    if (!cleanSlug) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Topic slug cannot be empty",
      );
    }

    updateData.slug = cleanSlug;
  }

  // ==========================
  // Check Duplicate Slug
  // ==========================
  if (updateData.slug) {
    const existingTopic = await JournalTopic.findOne({
      where: {
        slug: updateData.slug,
        id: {
          [Op.ne]: id,
        },
        is_active: true,
      },
    });

    if (existingTopic) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Another topic with this slug already exists",
      );
    }
  }

  // ==========================
  // Description
  // ==========================
  if (body.description !== undefined) {
    updateData.description = body.description || null;
  }
  Object.assign(updateData, topicTileFields(body));
  // ==========================
  // Image
  // ==========================
  if (files?.images?.length) {
    updateData.cover_image = files.images[0].filename;
  }

  // ==========================
  // Update
  // ==========================
  if (Object.keys(updateData).length) {
    await topic.update(updateData);
  }

  return getJournalTopicById(id, { admin: true });
};

const deleteJournalTopic = async (body) => {
  const topicIds = parseIds(body.topic_id);

  if (!topicIds.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid topic_id");
  }

  const topics = await JournalTopic.findAll({
    where: {
      id: topicIds,
      is_active: true,
    },
  });

  if (!topics.length) {
    throw new ApiError(httpStatus.NOT_FOUND, "No topics found");
  }

  // ==========================
  // Soft Delete
  // ==========================
  await JournalTopic.update(
    {
      is_active: false,
    },
    {
      where: {
        id: topicIds,
      },
    },
  );

  return true;
};

const getJournalFaqMappings = async (journalId) => {
  const journal = await Journal.findOne({
    where: {
      id: journalId,
      is_active: true,
    },
  });

  if (!journal) {
    throw new ApiError(httpStatus.NOT_FOUND, "Journal not found");
  }

  const mappings = await JournalFaqMapping.findAll({
    where: {
      journal_id: journalId,
    },
    include: [
      {
        model: JournalFaq,
        as: "faq",
        where: {
          is_active: true,
        },
        required: true,
      },
    ],
    order: [["sort_order", "ASC"]],
  });

  return mappings;
};

const updateJournalFaqMappings = async (journalId, body) => {
  const journal = await Journal.findOne({
    where: {
      id: journalId,
      is_active: true,
    },
  });

  if (!journal) {
    throw new ApiError(httpStatus.NOT_FOUND, "Journal not found");
  }

  const faqIds = parseIds(body.faq_ids);

  if (faqIds.length) {
    const faqs = await JournalFaq.findAll({
      where: {
        id: faqIds,
        is_active: true,
      },
      attributes: ["id"],
    });

    const validFaqIds = faqs.map((faq) => Number(faq.id));

    if (validFaqIds.length !== faqIds.length) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "One or more FAQ IDs are invalid",
      );
    }
  }

  await JournalFaqMapping.destroy({
    where: {
      journal_id: journalId,
    },
  });

  if (faqIds.length) {
    const mappingData = faqIds.map((faqId, index) => ({
      journal_id: journalId,
      faq_id: faqId,
      sort_order: index + 1,
    }));

    await JournalFaqMapping.bulkCreate(mappingData);
  }

  return getJournalFaqMappings(journalId);
};

const getJournalTopicMappings = async (journalId) => {
  const journal = await Journal.findOne({
    where: {
      id: journalId,
      is_active: true,
    },
  });

  if (!journal) {
    throw new ApiError(httpStatus.NOT_FOUND, "Journal not found");
  }

  const mappings = await JournalTopicMapping.findAll({
    where: {
      journal_id: journalId,
    },
    include: [
      {
        model: JournalTopic,
        as: "topic",
        where: {
          is_active: true,
        },
        required: true,
      },
    ],
    order: [["sort_order", "ASC"]],
  });

  return mappings;
};

const updateJournalTopicMappings = async (journalId, body) => {
  const journal = await Journal.findOne({
    where: {
      id: journalId,
      is_active: true,
    },
  });

  if (!journal) {
    throw new ApiError(httpStatus.NOT_FOUND, "Journal not found");
  }

  const topicIds = parseIds(body.topic_ids);

  if (topicIds.length) {
    const topics = await JournalTopic.findAll({
      where: {
        id: topicIds,
        is_active: true,
      },
      attributes: ["id"],
    });

    const validTopicIds = topics.map((topic) => Number(topic.id));

    if (validTopicIds.length !== topicIds.length) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "One or more Topic IDs are invalid",
      );
    }
  }

  await setArticleTopics(journalId, topicIds);

  return getJournalTopicMappings(journalId);
};

// A topic's paragraphs, from published articles only unless an admin asks (A-CNT-3, Nov 24).
const getJournalTopicParagraphs = async (topicId, { admin = false } = {}) => {
  const topic = await JournalTopic.findOne({
    where: {
      id: topicId,
      is_active: true,
    },
  });

  if (!topic) {
    throw new ApiError(httpStatus.NOT_FOUND, "Topic not found");
  }

  const mappings = await JournalTopicParagraphMapping.findAll({
    where: {
      topic_id: topicId,
    },
    include: [
      {
        model: Journal,
        as: "journal",
        where: {
          is_active: true,
          ...(admin ? {} : { status: "published" }),
        },
        required: true,
        attributes: ["id", "title", "slug", "content"],
      },
    ],
    order: [
      ["journal_id", "ASC"],
      ["sort_order", "ASC"],
    ],
  });

  return mappings;
};

const updateJournalTopicParagraphs = async (topicId, body) => {
  const topic = await JournalTopic.findOne({
    where: {
      id: topicId,
      is_active: true,
    },
  });

  if (!topic) {
    throw new ApiError(httpStatus.NOT_FOUND, "Topic not found");
  }

  const paragraphs = Array.isArray(body.paragraphs) ? body.paragraphs : [];

  // ==========================
  // Validate Paragraph Data
  // ==========================
  for (const item of paragraphs) {
    if (!item.journal_id) {
      throw new ApiError(httpStatus.BAD_REQUEST, "journal_id is required");
    }

    if (!item.paragraph_id) {
      throw new ApiError(httpStatus.BAD_REQUEST, "paragraph_id is required");
    }
  }

  // ==========================
  // Validate Journals
  // ==========================
  const journalIds = [
    ...new Set(
      paragraphs
        .map((item) => Number(item.journal_id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];

  if (journalIds.length) {
    const journals = await Journal.findAll({
      where: {
        id: journalIds,
        is_active: true,
      },
      attributes: ["id"],
    });

    if (journals.length !== journalIds.length) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "One or more journal IDs are invalid",
      );
    }
  }

  // ==========================
  // Replace Existing Mappings
  // ==========================
  await JournalTopicParagraphMapping.destroy({
    where: {
      topic_id: topicId,
    },
    force: true, // <-- THE ONLY LINE THAT'S NEW. Hard-delete instead of
    // soft-delete, so the row is actually gone from the
    // table and can never collide with the INSERT below.
  });

  if (!paragraphs.length) {
    return [];
  }

  // ==========================
  // Create New Mappings
  // ==========================
  const mappingData = paragraphs.map((item, index) => ({
    topic_id: topicId,
    journal_id: Number(item.journal_id),
    paragraph_id: String(item.paragraph_id),
    sort_order:
      item.sort_order !== undefined ? Number(item.sort_order) : index + 1,
  }));

  await JournalTopicParagraphMapping.bulkCreate(mappingData);

  return getJournalTopicParagraphs(topicId, { admin: true });
};

// PUT /journal/topic/:id/professionals { professional_ids }: the topic's professionals, all at once, in this order
// (topicItems.setItems). Since Nov 24 the topic's brands, in the same link table, stay (PUT .../brands sets them), and a
// professional taken off is one the AI won't put back.
const updateJournalTopicProfessionals = async (topicId, body) => {
  const topic = await topicItems.topicOrNotFound(topicId);
  await topicItems.setItems(topic.id, "professional", parseIds(body.professional_ids), { label: "professional IDs" });
  return getJournalTopicById(topic.id, { admin: true });
};

// PUT /journal/topic/:id/brands { brand_ids } (Nov 24): the topic's brands, all at once, in this order.
const updateJournalTopicBrands = async (topicId, body) => {
  const topic = await topicItems.topicOrNotFound(topicId);
  await topicItems.setItems(topic.id, "brand", parseIds(body.brand_ids), { label: "brand IDs" });
  return getJournalTopicById(topic.id, { admin: true });
};

const updateJournalTopicShops = async (topicId, body) => {
  const topic = await JournalTopic.findOne({
    where: {
      id: topicId,
      is_active: true,
    },
  });

  if (!topic) {
    throw new ApiError(httpStatus.NOT_FOUND, "Topic not found");
  }

  const shopIds = parseIds(body.shop_ids);

  // ==========================
  // Validate Shops
  // ==========================
  if (shopIds.length) {
    const shops = await Shop.findAll({
      where: {
        id: shopIds,
        is_active: true,
      },
      attributes: ["id"],
    });

    if (shops.length !== shopIds.length) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "One or more shop IDs are invalid",
      );
    }
  }

  // ==========================
  // Replace Existing Mappings
  // ==========================
  await JournalTopicProductMapping.destroy({
    where: {
      topic_id: topicId,
    },
  });

  // ==========================
  // Create New Mappings
  // ==========================
  if (shopIds.length) {
    await JournalTopicProductMapping.bulkCreate(
      shopIds.map((shopId, index) => ({
        topic_id: topicId,
        shop_id: shopId,
        sort_order: index + 1,
      })),
    );
  }

  // Return complete Topic
  return getJournalTopicById(topicId, { admin: true });
};

const updateJournalTopicPodcasts = async (topicId, body) => {
  const topic = await JournalTopic.findOne({
    where: {
      id: topicId,
      is_active: true,
    },
  });

  if (!topic) {
    throw new ApiError(httpStatus.NOT_FOUND, "Topic not found");
  }

  const podcastIds = parseIds(body.podcast_ids);

  // ==========================
  // Validate Podcasts
  // ==========================
  if (podcastIds.length) {
    const podcasts = await PodcastSchedule.findAll({
      where: {
        id: podcastIds,
      },
      attributes: ["id"],
    });

    if (podcasts.length !== podcastIds.length) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "One or more podcast IDs are invalid",
      );
    }
  }

  // ==========================
  // Replace Existing Mappings
  // ==========================
  await JournalTopicPodcastMapping.destroy({
    where: {
      topic_id: topicId,
    },
    force: true,
  });

  // ==========================
  // Create New Mappings
  // ==========================
  if (podcastIds.length) {
    await JournalTopicPodcastMapping.bulkCreate(
      podcastIds.map((podcastId, index) => ({
        topic_id: topicId,
        podcast_id: podcastId,
        sort_order: index + 1,
      })),
    );
  }

  // Return complete Topic
  return getJournalTopicById(topicId, { admin: true });
};

module.exports = {
  createJournal,
  getJournalsByCategory,
  getAllJournals,
  listJournals,
  searchTopics,
  articlesOfAccount,
  findJournalById,
  findJournalBySlug,
  sitemapArticles,
  sitemapTopics,
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

  // Topic Professionals and Brands
  updateJournalTopicProfessionals,
  updateJournalTopicBrands,

  // Topic Products
  updateJournalTopicShops,

  // Topic Podcasts
  updateJournalTopicPodcasts,

  // Topic Paragraphs
  getJournalTopicParagraphs,
  updateJournalTopicParagraphs,
};
