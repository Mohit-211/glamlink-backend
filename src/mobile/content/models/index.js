// The mobile/content module's tables.
const Faq = require('./faq.model');
const BannerMedia = require('./bannerMedia.model');

// The associations this module owns: the side that holds the foreign key. Called once every module's
// models are loaded (src/models.js), with all of them by name.
const associate = ({ User }) => {
  User.hasMany(BannerMedia, {
    foreignKey: "user_id",
    as: "user_banner",
  });

  BannerMedia.belongsTo(User, {
    foreignKey: "user_id",
    as: "banner_user",
  });
};

module.exports = { models: { Faq, BannerMedia }, associate };
