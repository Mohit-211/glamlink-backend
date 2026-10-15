// The shared/billing module's tables.
const Payment = require('./payment.model');

// The associations this module owns: the side that holds the foreign key. Called once every module's
// models are loaded (src/models.js), with all of them by name.
const associate = ({ User }) => {
  User.hasMany(Payment, { foreignKey: "user_id", as: "user_payments" });

  Payment.belongsTo(User, { foreignKey: "user_id", as: "payment_user" });
};

module.exports = { models: { Payment }, associate };
