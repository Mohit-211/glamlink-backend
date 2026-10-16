// The website/access-card module's tables.
const BusinessCard = require('./businessCard.model');
const BusinessCardCategory = require('./businessCardCategory.model');
const BusinessLocation = require('./businessLocation.model');
const BusinessHour = require('./businessHour.model');
const BusinessGalleryMedia = require('./businessGalleryMedia.model');
const AccessOrder = require('./accessOrder.model');
const AccessCardAnalytics = require('./accessCardAnalytics.model');
const Directory = require('./directory.model');
const DirectoryCategory = require('./directoryCategory.model');
const AccessProduct = require('./accessProduct.model');
const AccessPriceChange = require('./accessPriceChange.model');
const AccessPlan = require('./accessPlan.model');
const AccessDiscount = require('./accessDiscount.model');
const AccessPriceOverride = require('./accessPriceOverride.model');
const AccessSetting = require('./accessSetting.model');
const AccessSubscription = require('./accessSubscription.model');
const AccessCheckout = require('./accessCheckout.model');

// The associations this module owns: the side that holds the foreign key. Called once every module's
// models are loaded (src/models.js), with all of them by name.
const associate = ({ Payment, User }) => {
  BusinessCard.hasMany(Payment, {
    foreignKey: "business_card_id",
    as: "business_card_payments",
  });

  Payment.belongsTo(BusinessCard, {
    foreignKey: "business_card_id",
    as: "business_card",
  });

  BusinessCard.belongsTo(User, {
    foreignKey: "user_id",
    as: "business_user",
  });

  User.hasMany(BusinessCard, {
    foreignKey: "user_id",
    as: "user_business_cards",
  });


  // BusinessCard → Locations
  BusinessCard.hasMany(BusinessLocation, {
    foreignKey: "business_card_id",
    as: "locations",
  });

  BusinessLocation.belongsTo(BusinessCard, {
    foreignKey: "business_card_id",
  });


  // BusinessCard → Gallery
  BusinessCard.hasMany(BusinessGalleryMedia, {
    foreignKey: "business_card_id",
    as: "images",
  });

  BusinessGalleryMedia.belongsTo(BusinessCard, {
    foreignKey: "business_card_id",
  });


  // BusinessCard → Business Hours
  BusinessCard.hasMany(BusinessHour, {
    foreignKey: "business_card_id",
    as: "business_hour",
  });

  BusinessHour.belongsTo(BusinessCard, {
    foreignKey: "business_card_id",
  });

  Directory.hasMany(DirectoryCategory, {
    foreignKey: "directory_id",
    as: "directory_categories",
  });

  DirectoryCategory.belongsTo(Directory, {
    foreignKey: "directory_id",
  });

  DirectoryCategory.belongsTo(BusinessCardCategory, {
    foreignKey: "category_id",
    as: "category",
  });

  BusinessCard.hasMany(AccessOrder, {
    foreignKey: "business_card_id",
    as: "access_orders",
  });

  AccessOrder.belongsTo(BusinessCard, {
    foreignKey: "business_card_id",
    as: "business_card",
  });

  BusinessCard.hasMany(AccessCardAnalytics, {
    foreignKey: "business_card_id",
    as: "analytics",
    onDelete: "CASCADE",
  });

  AccessCardAnalytics.belongsTo(BusinessCard, {
    foreignKey: "business_card_id",
    as: "business_card",
  });

  Payment.hasOne(AccessOrder, {
    foreignKey: "payment_id",
    as: "access_order",
  });

  AccessOrder.belongsTo(Payment, {
    foreignKey: "payment_id",
    as: "payment",
  });

  User.hasMany(AccessOrder, {
    foreignKey: "user_id",
    as: "access_orders",
  });

  AccessOrder.belongsTo(User, {
    foreignKey: "user_id",
    as: "user",
  });
};

module.exports = {
  models: {
    BusinessCard, BusinessCardCategory, BusinessLocation, BusinessHour, BusinessGalleryMedia, AccessOrder, AccessCardAnalytics,
    Directory, DirectoryCategory, AccessProduct, AccessPriceChange, AccessPlan, AccessDiscount, AccessPriceOverride, AccessSetting,
    AccessSubscription, AccessCheckout,
  },
  associate,
};
