/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");

class JournalFaqMapping extends Model {}

JournalFaqMapping.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    journal_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },

    faq_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },

    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    created_at: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
  },
  {
    sequelize,
    tableName: "journal_faq_mappings",
    timestamps: false,
    underscored: true,
  },
);

module.exports = JournalFaqMapping;