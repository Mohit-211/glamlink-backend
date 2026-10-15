// The mobile/promotions module's tables.
const UserPromotion = require('./userPromotion.model');
const PromotionPayment = require('./promotionPayment.model');
const Keyword = require('./keyword.model');

// The associations this module owns: the side that holds the foreign key. Called once every module's
// models are loaded (src/models.js), with all of them by name.
const associate = ({ User }) => {
  User.hasMany(UserPromotion, {
    foreignKey: "user_id",
    as: "all_promotions",
  });
};

module.exports = { models: { UserPromotion, PromotionPayment, Keyword }, associate };
