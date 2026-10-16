const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/db/central.db");

class AccessOrder extends Model {}

AccessOrder.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    // Example: GL-20260831-000001
    order_number: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },

    // ================= RELATIONSHIPS =================

    business_card_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },

    payment_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      unique: true,
    },

    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },

    // ================= CUSTOMER =================

    customer_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    customer_email: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    // ================= PAYMENT =================

    amount_paid: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },

    payment_status: {
      type: DataTypes.ENUM(
        "paid",
        "failed",
        "refunded"
      ),
      allowNull: true,
      defaultValue: "paid",
    },

    // ================= SHIPPING SNAPSHOT =================

    recipient_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    shipping_address_line_1: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    shipping_address_line_2: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    shipping_city: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    shipping_state: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    shipping_postal_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    shipping_country: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: "US",
    },

    shipping_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
    },

    // ================= FULFILLMENT =================

    tracking_number: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    tracking_link: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // The rate chosen at checkout, the label bought with Shippo, and Shippo's tracking.
    carrier: { type: DataTypes.STRING(100), allowNull: true },
    service: { type: DataTypes.STRING(150), allowNull: true },
    shippo_shipment_id: { type: DataTypes.STRING, allowNull: true },
    shippo_rate_id: { type: DataTypes.STRING, allowNull: true },
    shippo_transaction_id: { type: DataTypes.STRING, allowNull: true },
    label_url: { type: DataTypes.TEXT, allowNull: true },
    label_created_at: { type: DataTypes.DATE, allowNull: true },
    tracking_status: { type: DataTypes.STRING(30), allowNull: true },
    tracking_status_details: { type: DataTypes.TEXT, allowNull: true },
    shipped_at: { type: DataTypes.DATE, allowNull: true },
    delivered_at: { type: DataTypes.DATE, allowNull: true },

    // Empty for an order that ships nothing (Access Pro alone).
    fulfillment_status: {
      type: DataTypes.ENUM(
        "pending",
        "processing",
        "shipped",
        "delivered"
      ),
      allowNull: true,
      defaultValue: "pending",
    },

    // ================= FLAGS =================

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
    tableName: "access_orders",
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  }
);

module.exports = AccessOrder;