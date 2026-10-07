/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");

class Cart extends Model {}
Cart.init(
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
			// onDelete: "CASCADE",
			// onUpdate: "CASCADE",
			// references: {
			// 	model: "products",
			// 	key: "id",
			// },
		},
		total_items: {
			type: DataTypes.INTEGER,
			allowNull: true,
			defaultValue: 0,
		},
		price: {
			type: DataTypes.FLOAT, // or DECIMAL(10, 2)
			allowNull: false,
		},
		total_price: {
			type: DataTypes.FLOAT, // or DECIMAL(10, 2)
			allowNull: false,
		},
		
		// price: {
		// 	type: DataTypes.INTEGER,
		// 	allowNull: false,
		// },
		// total_price: {
		// 	type: DataTypes.INTEGER,
		// 	allowNull: false,
		// },
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
		tableName: "carts",
		timestamps: true,
		underscored: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
	}
);

Cart.beforeUpdate(async (cart) => {
	cart.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});
Cart.beforeDestroy(async (cart) => {
	cart.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
	cart.is_active = false;
});

module.exports = Cart;
