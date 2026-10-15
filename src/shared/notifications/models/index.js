// The shared/notifications module's tables.
const Notification = require('./notification.model');

// The associations this module owns: the side that holds the foreign key. Called once every module's
// models are loaded (src/models.js), with all of them by name.
const associate = ({ User }) => {
  Notification.belongsTo(User, { foreignKey: "sender_id", as: "sender" });

  Notification.belongsTo(User, { foreignKey: "receiver_id", as: "receiver" });
};

module.exports = { models: { Notification }, associate };
