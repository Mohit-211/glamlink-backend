// The website/content module's tables.
const Journal = require('./journal.model');
const JournalCategory = require('./journalCategory.model');
const JournalDownload = require('./journalDownload.model');
const JournalShop = require('./journalShop.model');
const JournalFaq = require('./journalFaq.model');
const JournalFaqMapping = require('./journalFaqMapping.model');
const JournalTopic = require('./journalTopic.model');
const JournalTopicMapping = require('./journalTopicMapping.model');
const JournalTopicPodcastMapping = require('./journalTopicPodcastMapping.model');
const JournalTopicProductMapping = require('./journalTopicProductMapping.model');
const JournalTopicProfessionalMapping = require('./journalTopicProfessionalMapping.model');
const JournalTopicParagraphMapping = require('./journalTopicParagraphMapping.model');
const Author = require('./author.model');
const PodcastSchedule = require('./podcastSchedule.model');
const Education = require('./education.model');
const Event = require('./event.model');
const Shop = require('./shop.model');
const Ad = require('./ad.model');
const Blog = require('./blog.model');
const BlogCategory = require('./blogCategory.model');
const BlogCategoryMapping = require('./blogCategoryMapping.model');
const BlogAttachment = require('./blogAttachment.model');

// The associations this module owns: the side that holds the foreign key. Called once every module's
// models are loaded (src/models.js), with all of them by name.
const associate = ({ User }) => {

  //Blog
  Blog.belongsToMany(BlogCategory, {
    through: "BlogCategoryMapping",
    foreignKey: "blog_id",
    as: "blog_categories",
  });

  BlogCategory.belongsToMany(Blog, {
    through: "BlogCategoryMapping",
    foreignKey: "blog_category_id",
    as: "blogs",
  });

  Blog.hasMany(BlogAttachment, {
    foreignKey: "blog_id",
    as: "blog_attachments",
  });

  BlogAttachment.belongsTo(Blog, {
    foreignKey: "blog_id",
    as: "attachment_blog",
  });


  // journal
  JournalCategory.hasMany(Journal, {
    foreignKey: "category_id",
    as: "journals",
  });

  Journal.belongsTo(JournalCategory, {
    foreignKey: "category_id",
    as: "journal_category",
  });

  Author.hasMany(Journal, {
    foreignKey: "author_id",
    as: "journals",
  });

  Journal.belongsTo(Author, {
    foreignKey: "author_id",
    as: "journal_author",
  });

  Journal.hasMany(JournalDownload, {
    foreignKey: "journal_id",
    as: "downloads",
  });

  JournalDownload.belongsTo(Journal, {
    foreignKey: "journal_id",
    as: "journal",
  });

  Journal.belongsToMany(Shop, {
    through: JournalShop,
    foreignKey: "journal_id",
    otherKey: "shop_id",
    as: "shops",
  });

  Shop.belongsToMany(Journal, {
    through: JournalShop,
    foreignKey: "shop_id",
    otherKey: "journal_id",
    as: "journals",
  });


  // =========================================================
  // JOURNAL FAQ
  // =========================================================
  Journal.hasMany(JournalFaqMapping, {
    foreignKey: "journal_id",
    as: "faq_mappings",
  });

  JournalFaqMapping.belongsTo(Journal, {
    foreignKey: "journal_id",
    as: "journal",
  });

  JournalFaq.hasMany(JournalFaqMapping, {
    foreignKey: "faq_id",
    as: "journal_mappings",
  });

  JournalFaqMapping.belongsTo(JournalFaq, {
    foreignKey: "faq_id",
    as: "faq",
  });

  Journal.belongsToMany(JournalFaq, {
    through: JournalFaqMapping,
    foreignKey: "journal_id",
    otherKey: "faq_id",
    as: "faqs",
  });

  JournalFaq.belongsToMany(Journal, {
    through: JournalFaqMapping,
    foreignKey: "faq_id",
    otherKey: "journal_id",
    as: "journals",
  });


  // =========================================================
  // JOURNAL TOPIC
  // =========================================================
  Journal.hasMany(JournalTopicMapping, {
    foreignKey: "journal_id",
    as: "topic_mappings",
  });

  JournalTopicMapping.belongsTo(Journal, {
    foreignKey: "journal_id",
    as: "journal",
  });

  JournalTopic.hasMany(JournalTopicMapping, {
    foreignKey: "topic_id",
    as: "journal_mappings",
  });

  JournalTopicMapping.belongsTo(JournalTopic, {
    foreignKey: "topic_id",
    as: "topic",
  });

  Journal.belongsToMany(JournalTopic, {
    through: JournalTopicMapping,
    foreignKey: "journal_id",
    otherKey: "topic_id",
    as: "topics",
  });

  JournalTopic.belongsToMany(Journal, {
    through: JournalTopicMapping,
    foreignKey: "topic_id",
    otherKey: "journal_id",
    as: "journals",
  });


  // =========================================================
  // JOURNAL TOPIC → PARAGRAPHS
  // =========================================================
  JournalTopic.hasMany(JournalTopicParagraphMapping, {
    foreignKey: "topic_id",
    as: "paragraph_mappings",
  });

  JournalTopicParagraphMapping.belongsTo(JournalTopic, {
    foreignKey: "topic_id",
    as: "topic",
  });

  Journal.hasMany(JournalTopicParagraphMapping, {
    foreignKey: "journal_id",
    as: "topic_paragraph_mappings",
  });

  JournalTopicParagraphMapping.belongsTo(Journal, {
    foreignKey: "journal_id",
    as: "journal",
  });


  // =========================================================
  // TOPIC → PROFESSIONALS
  // =========================================================
  JournalTopic.hasMany(JournalTopicProfessionalMapping, {
    foreignKey: "topic_id",
    as: "professional_mappings",
  });

  JournalTopicProfessionalMapping.belongsTo(JournalTopic, {
    foreignKey: "topic_id",
    as: "topic",
  });

  User.hasMany(JournalTopicProfessionalMapping, {
    foreignKey: "user_id",
    as: "topic_professional_mappings",
  });

  JournalTopicProfessionalMapping.belongsTo(User, {
    foreignKey: "user_id",
    as: "professional",
  });

  JournalTopic.belongsToMany(User, {
    through: JournalTopicProfessionalMapping,
    foreignKey: "topic_id",
    otherKey: "user_id",
    as: "professionals",
  });

  User.belongsToMany(JournalTopic, {
    through: JournalTopicProfessionalMapping,
    foreignKey: "user_id",
    otherKey: "topic_id",
    as: "journal_topics",
  });


  // =========================================================
  // TOPIC → SHOPS
  // =========================================================
  JournalTopic.hasMany(JournalTopicProductMapping, {
    foreignKey: "topic_id",
    as: "product_mappings",
  });

  JournalTopicProductMapping.belongsTo(JournalTopic, {
    foreignKey: "topic_id",
    as: "topic",
  });

  Shop.hasMany(JournalTopicProductMapping, {
    foreignKey: "shop_id",
    as: "topic_product_mappings",
  });

  JournalTopicProductMapping.belongsTo(Shop, {
    foreignKey: "shop_id",
    as: "shop",
  });

  JournalTopic.belongsToMany(Shop, {
    through: JournalTopicProductMapping,
    foreignKey: "topic_id",
    otherKey: "shop_id",
    as: "shops",
  });

  Shop.belongsToMany(JournalTopic, {
    through: JournalTopicProductMapping,
    foreignKey: "shop_id",
    otherKey: "topic_id",
    as: "journal_topics",
  });


  // =========================================================
  // TOPIC → PODCASTS
  // =========================================================
  JournalTopic.hasMany(JournalTopicPodcastMapping, {
    foreignKey: "topic_id",
    as: "podcast_mappings",
  });

  JournalTopicPodcastMapping.belongsTo(JournalTopic, {
    foreignKey: "topic_id",
    as: "topic",
  });

  PodcastSchedule.hasMany(JournalTopicPodcastMapping, {
    foreignKey: "podcast_id",
    as: "topic_podcast_mappings",
  });

  JournalTopicPodcastMapping.belongsTo(PodcastSchedule, {
    foreignKey: "podcast_id",
    as: "podcast",
  });

  JournalTopic.belongsToMany(PodcastSchedule, {
    through: JournalTopicPodcastMapping,
    foreignKey: "topic_id",
    otherKey: "podcast_id",
    as: "podcasts",
  });

  PodcastSchedule.belongsToMany(JournalTopic, {
    through: JournalTopicPodcastMapping,
    foreignKey: "podcast_id",
    otherKey: "topic_id",
    as: "journal_topics",
  });
};

module.exports = { models: { Journal, JournalCategory, JournalDownload, JournalShop, JournalFaq, JournalFaqMapping, JournalTopic, JournalTopicMapping, JournalTopicPodcastMapping, JournalTopicProductMapping, JournalTopicProfessionalMapping, JournalTopicParagraphMapping, Author, PodcastSchedule, Education, Event, Shop, Ad, Blog, BlogCategory, BlogCategoryMapping, BlogAttachment }, associate };
