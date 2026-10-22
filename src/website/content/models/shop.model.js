const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/db/central.db");
const { freeSlug } = require("../../../core/db/freeSlug");

class Shop extends Model {}

Shop.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // The product page's address (GET /discover/shop/slug/:slug), its own: made from the title when the product is
    // added (below), kept when the title changes.
    slug: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },

    short_description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    // The product page's longer text; it shows short_description without one.
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    category: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    brand: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // The account that put the product up (null: Glamlink's own pick), and the brand account that makes it.
    owner_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    brand_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },

    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },

    cover_image: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    link: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM("draft", "published"),
      defaultValue: "published",
    },
    // The home page's Shop Products row (GET /discover/shop?featured=true), in featured_order.
    is_featured: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    featured_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    sort_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
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
    tableName: "shops",
    timestamps: true,
    underscored: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
    paranoid: true,
  },
);

// Every product added (by an admin, its owner or a CSV file) gets a slug from its title unless it was given one.
Shop.beforeCreate(async (product) => {
  if (!product.slug) product.slug = await freeSlug(Shop, product.title, { fallback: "product" });
});
Shop.beforeBulkCreate(async (products) => {
  const taken = new Set();
  for (const product of products) {
    if (!product.slug) product.slug = await freeSlug(Shop, product.title, { fallback: "product", taken });
    taken.add(product.slug);
  }
});

module.exports = Shop;