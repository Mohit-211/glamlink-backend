/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");

const sequelize = require("../config/central.db");

class AccessCardAnalytics extends Model {}

AccessCardAnalytics.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    business_card_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },

    event_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    event_target: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    visitor_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    session_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },

    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    referrer: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    device_type: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    created_at: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
  },
  {
    sequelize,
    tableName: "access_card_analytics",
    timestamps: false,
    underscored: true,
  },
);

module.exports = AccessCardAnalytics;