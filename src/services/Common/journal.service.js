/** @format */

const httpStatus = require("http-status");
const moment = require("moment");
const { Op } = require("sequelize");
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
  JournalTopicProfessionalMapping,
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
const ApiError = require("../../utils/ApiError");

const createJournal = async (reqBody, files) => {
  try {
    const isPublished = reqBody.status === "published";

    const journalObj = {
      title: reqBody.title,
      author_id: reqBody.author_id,
      category_id: reqBody.category_id || null,
      short_description: reqBody.short_description,
      status: isPublished ? "published" : "draft",
      publish_date: reqBody.publish_date || null,
      content: reqBody.content,

      seo_title: reqBody.seo_title || null,
      meta_description: reqBody.meta_description || null,
      slug: reqBody.slug || null,
      created_at: moment(),
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

    return journalDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getJournalsByCategory = async (category_id) => {
  try {
    if (!category_id) {
      throw new ApiError(httpStatus.BAD_REQUEST, "category_id is required");
    }

    const journalDoc = await Journal.findAndCountAll({
      where: {
        is_active: true,
        category_id: category_id,
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
        "Failed to get Journals by category",
      );
    }

    return journalDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllJournals = async () => {
  try {
    const journalDoc = await Journal.findAndCountAll({
      where: {
        is_active: true,
        status: "published",
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const findJournalById = async (id) => {
  try {
    const journalDoc = await Journal.findOne({
      where: {
        id,
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

    return journalDoc ? journalDoc : "No Journal Found";
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateJournal = async (reqBody, id, files) => {
  try {
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

    if (reqBody.seo_title !== undefined) {
      journalDoc.seo_title = reqBody.seo_title || null;
    }

    if (reqBody.meta_description !== undefined) {
      journalDoc.meta_description = reqBody.meta_description || null;
    }

    if (reqBody.slug !== undefined) {
      journalDoc.slug = reqBody.slug || null;
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

      await JournalTopicMapping.destroy({
        where: {
          journal_id: id,
        },
      });

      if (topicIds.length) {
        await JournalTopicMapping.bulkCreate(
          topicIds.map((topicId, index) => ({
            journal_id: id,
            topic_id: topicId,
            sort_order: index + 1,
          })),
        );
      }
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

    return journalDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const deleteJournal = async (body) => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateJournalSortOrder = async (body) => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const uploadImage = async (files) => {
  try {
    if (!files || !files.images || !files.images.length) {
      throw new ApiError(httpStatus.BAD_REQUEST, "No image uploaded");
    }

    // Multer already converted filename to full public URL
    const imageUrl = files.images[0].filename;

    return {
      location: imageUrl, // 🔥 TinyMCE requires "location"
    };
  } catch (error) {
    throw error instanceof ApiError
      ? error
      : new ApiError(
          error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
          error.message,
        );
  }
};

const getAllJournalsByAdmin = async () => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
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
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllJournalFaqs = async () => {
  try {
    const faqs = await JournalFaq.findAll({
      where: {
        is_active: true,
      },
      order: [["id", "DESC"]],
    });

    return faqs;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getJournalFaqById = async (id) => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateJournalFaq = async (id, body) => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const deleteJournalFaq = async (body) => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

// ==========================
// Topic CRUD
// ==========================

const createJournalTopic = async (body, files) => {
  try {
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
    };

    // ==========================
    // Topic Image
    // ==========================
    if (files?.images?.length) {
      topicData.cover_image = files.images[0].filename;
    }

    const topic = await JournalTopic.create(topicData);

    return topic;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllJournalTopics = async (query = {}) => {
  try {
    const { search = "" } = query;

    const where = {
      is_active: true,
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
      order: [["name", "ASC"]],
    });

    return topics;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getJournalTopicById = async (id) => {
  try {
    const topic = await JournalTopic.findOne({
      where: {
        id,
        is_active: true,
      },
      include: [
        // ==========================
        // Journals
        // ==========================
        {
          model: Journal,
          as: "journals",
          through: {
            attributes: ["sort_order"],
          },
          where: {
            is_active: true,
          },
          required: false,
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
          ],
        },

        // ==========================
        // Professionals
        // ==========================
        {
          model: User,
          as: "professionals",
          through: {
            attributes: ["sort_order"],
          },
          attributes: ["id", "email"],
          where: {
            is_active: true,
            role_id: 7,
          },
          required: false,

          include: [
            // ==========================
            // User Profile
            // ==========================
            {
              model: Profile,
              as: "user_profile",
              attributes: ["name"],
              required: false,
            },

            // ==========================
            // Business Cards
            // ==========================
            {
              model: BusinessCard,
              as: "user_business_cards",
              where: {
                is_active: true,
              },
              required: false,

              include: [
                // ==========================
                // Business Locations
                // ==========================
                {
                  model: BusinessLocation,
                  as: "locations",
                },

                // ==========================
                // Business Images
                // ==========================
                {
                  model: BusinessGalleryMedia,
                  as: "images",
                },

                // ==========================
                // Business Hours
                // ==========================
                {
                  model: BusinessHour,
                  as: "business_hour",
                },

                // ==========================
                // Business User
                // ==========================
                {
                  model: User,
                  as: "business_user",
                  required: false,
                  attributes: [
                    "id",
                    "subscription_status",
                    "subscription_started_at",
                    "subscription_renewal_at",
                  ],
                },
              ],
            },
          ],
        },

        // ==========================
        // Shops
        // ==========================
        {
          model: Shop,
          as: "shops",
          through: {
            attributes: ["sort_order"],
          },
          where: {
            is_active: true,
          },
          required: false,
        },

        // ==========================
        // Podcasts
        // ==========================
        {
          model: PodcastSchedule,
          as: "podcasts",
          through: {
            attributes: ["sort_order"],
          },
          required: false,
        },
      ],
    });

    if (!topic) {
      throw new ApiError(httpStatus.NOT_FOUND, "Topic not found");
    }

    const data = topic.toJSON();

    // ==========================
    // Normalize Professionals
    // ==========================
    if (Array.isArray(data.professionals)) {
      data.professionals = data.professionals.map((professional) => {
        const businessCards = Array.isArray(
          professional.user_business_cards,
        )
          ? professional.user_business_cards
          : [];

        const businessCard = businessCards.length
          ? businessCards[0]
          : null;

        return {
          id: professional.id,
          email: professional.email,
          name: professional.user_profile?.name || null,
          business_card: businessCard,
        };
      });
    }

    return data;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateJournalTopic = async (id, body, files) => {
  try {
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

    return getJournalTopicById(id);
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const deleteJournalTopic = async (body) => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getJournalFaqMappings = async (journalId) => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateJournalFaqMappings = async (journalId, body) => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getJournalTopicMappings = async (journalId) => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateJournalTopicMappings = async (journalId, body) => {
  try {
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

    await JournalTopicMapping.destroy({
      where: {
        journal_id: journalId,
      },
    });

    if (topicIds.length) {
      const mappingData = topicIds.map((topicId, index) => ({
        journal_id: journalId,
        topic_id: topicId,
        sort_order: index + 1,
      }));

      await JournalTopicMapping.bulkCreate(mappingData);
    }

    return getJournalTopicMappings(journalId);
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getJournalTopicParagraphs = async (topicId) => {
  try {
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
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateJournalTopicParagraphs = async (topicId, body) => {
  try {
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

    return getJournalTopicParagraphs(topicId);
  } catch (error) {
    console.error("updateJournalTopicParagraphs failed:", {
      name: error.name,
      message: error.message,
      errors: error.errors,
      sql: error.sql,
      original: error.original?.sqlMessage,
      stack: error.stack,
    });

    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateJournalTopicProfessionals = async (topicId, body) => {
  try {
    const topic = await JournalTopic.findOne({
      where: {
        id: topicId,
        is_active: true,
      },
    });

    if (!topic) {
      throw new ApiError(httpStatus.NOT_FOUND, "Topic not found");
    }

    const professionalIds = parseIds(body.professional_ids);

    // ==========================
    // Validate Professionals
    // ==========================
    if (professionalIds.length) {
      const professionals = await User.findAll({
        where: {
          id: professionalIds,
          role_id: 7,
          is_active: true,
        },
        attributes: ["id"],
      });

      if (professionals.length !== professionalIds.length) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "One or more professional IDs are invalid",
        );
      }
    }

    // ==========================
    // Replace Existing Mappings
    // ==========================
    await JournalTopicProfessionalMapping.destroy({
      where: {
        topic_id: topicId,
      },
      force: true,
    });

    // ==========================
    // Create New Mappings
    // ==========================
    if (professionalIds.length) {
      await JournalTopicProfessionalMapping.bulkCreate(
        professionalIds.map((professionalId, index) => ({
          topic_id: topicId,
          user_id: professionalId,
          sort_order: index + 1,
        })),
      );
    }

    // Return complete Topic
    return getJournalTopicById(topicId);
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateJournalTopicShops = async (topicId, body) => {
  try {
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
    return getJournalTopicById(topicId);
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const updateJournalTopicPodcasts = async (topicId, body) => {
  try {
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
    return getJournalTopicById(topicId);
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

module.exports = {
  createJournal,
  getJournalsByCategory,
  getAllJournals,
  findJournalById,
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
