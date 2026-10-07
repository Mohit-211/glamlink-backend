/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");

class Product extends Model {}
Product.init(
	{
		id: {
			type: DataTypes.BIGINT.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		unique_product_id: {
			type: DataTypes.STRING,
			allowNull: true,
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
		vendor_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: true,
			onDelete: "CASCADE",
			onUpdate: "CASCADE",
			references: {
				model: "vendors",
				key: "id",
			},
		},
		brand_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: true,
			onDelete: "CASCADE",
			onUpdate: "CASCADE",
			references: {
				model: "brands",
				key: "id",
			},
		},
		// barcode_id: {
		// 	type: DataTypes.STRING,
		// 	allowNull: false,
		// },
		name: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		description: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		price: {
			type: DataTypes.DECIMAL(10, 2), // Allows for precision like 19.99, 109.50, etc.
			allowNull: true,
		},
		
		// price: {
		// 	type: DataTypes.INTEGER,
		// 	allowNull: true,
		// },
		stock: {
			type: DataTypes.INTEGER,
			allowNull: true,
			defaultValue: 0,
		},
		average_rating: {
			type: DataTypes.STRING,
			allowNull: true,
			defaultValue: 0,
		},
		rating: {
			type: DataTypes.STRING,
			allowNull: true,
			defaultValue: 0,
		},
		review_count: {
			type: DataTypes.STRING,
			allowNull: true,
			defaultValue: 0,
		},
		numeral_tax_category: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		status: {
			type: DataTypes.ENUM("pending", "approved", "rejected"),
			defaultValue: "pending",
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
		tableName: "products",
		timestamps: true,
		underscored: true,
		paranoid: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
		deletedAt: "deleted_at",
	}
);

Product.beforeUpdate(async (product) => {
	product.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});
Product.beforeDestroy(async (product) => {
	product.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
	product.is_active = false;
});

module.exports = Product;
