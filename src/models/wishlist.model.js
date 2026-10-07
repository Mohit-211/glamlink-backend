const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");

class Wishlist extends Model {}

Wishlist.init(
	{
		id: {
			type: DataTypes.BIGINT.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		user_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: false,
			onDelete: "CASCADE",
			onUpdate: "CASCADE",
			references: {
				model: "users",
				key: "id",
			},
		},
		product_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: true,
			onDelete: "CASCADE",
			onUpdate: "CASCADE",
			references: {
				model: "products",
				key: "id",
			},
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
	},
	{
		sequelize,
		tableName: "wishlists",
		timestamps: true,
		underscored: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
	}
);

Wishlist.beforeUpdate(async (wishlist) => {
    wishlist.updated_at = new Date()
      .toISOString()
      .replace(/T/, " ")
      .replace(/\..+/g, "");
  });
  Wishlist.beforeDestroy(async (wishlist) => {
    wishlist.deleted_at = new Date()
      .toISOString()
      .replace(/T/, " ")
      .replace(/\..+/g, "");
    wishlist.is_active = false;
  });
  

module.exports = Wishlist;
