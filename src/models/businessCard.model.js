/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");

class BusinessCard extends Model {}

BusinessCard.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    created_by_admin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    // Basic profile
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    professional_title: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    email: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // Business identity
    business_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // Booking
    booking_link: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    preferred_booking_method: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    is_phone_visible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    // Specialties
    primary_specialty: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    specialties: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    // Social / links
    website: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    custom_handle: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    social_media: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    other_links: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    color_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    featured_links: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    // Media
    profile_image: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // Info
    important_info: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    excites_about_glamlink: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    biggest_pain_points: {
      type: DataTypes.JSON,
      allowNull: true,
    },

    // Flags
    offer_promotion: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    promotion_details: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    elite_setup: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    business_card_link: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    business_card_qr: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("pending", "accepted", "rejected"),
      defaultValue: "pending",
    },

    plan_type: {
      type: DataTypes.ENUM(
        "free",
        "nfc_only",
        "subscription_only",
        "nfc_with_subscription",
      ),
      allowNull: true,
    },
    nfc_status: {
      type: DataTypes.ENUM("not_purchased", "pending", "paid", "cancelled"),
      defaultValue: "not_purchased",
    },

    address_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    user_address_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },

    shipping_amount: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },

    is_founder: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    is_details: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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
    tableName: "business_cards",
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    paranoid: true,
  },
);

BusinessCard.beforeUpdate(async (card) => {
  card.updated_at = new Date()
    .toISOString()
    .replace(/T/, " ")
    .replace(/\..+/g, "");
});

BusinessCard.beforeDestroy(async (card) => {
  card.deleted_at = new Date()
    .toISOString()
    .replace(/T/, " ")
    .replace(/\..+/g, "");
  card.is_active = false;
});

module.exports = BusinessCard;
