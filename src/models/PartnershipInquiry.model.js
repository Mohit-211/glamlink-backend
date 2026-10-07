/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");

class PartnershipInquiry extends Model {}

PartnershipInquiry.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    company_brand: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    website_instagram: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    interested_in: {
      type: DataTypes.TEXT,
      allowNull: true,

      get() {
        const raw = this.getDataValue("interested_in");

        if (!raw) {
          return [];
        }

        try {
          return JSON.parse(raw);
        } catch (error) {
          return [];
        }
      },

      set(value) {
        this.setDataValue(
          "interested_in",
          Array.isArray(value) ? JSON.stringify(value) : value,
        );
      },
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    created_at: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },

    updated_at: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      onUpdate: Sequelize.literal("CURRENT_TIMESTAMP"),
    },

    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "partnership_inquiries",

    timestamps: true,
    underscored: true,

    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",

    paranoid: true,
  },
);

module.exports = PartnershipInquiry;