/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");
const { paymentStatusTypes } = require("../config/types");

class Order extends Model {}

Order.init(
	{
		id: {
			type: DataTypes.BIGINT.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		order_id: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		user_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: false,
			onDelete: "CASCADE",
		},
		address_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: false,
			onDelete: "CASCADE",
			onUpdate: "CASCADE",
			references: {
				model: "user_address",
				key: "id",
			},
		},
		total_amount: {
			// type: DataTypes.INTEGER,
			type: DataTypes.DECIMAL(10, 2),
			allowNull: false,
			defaultValue: 0,
		},
		total_items: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 1,
		},
		tax_amount: {
			// type: DataTypes.INTEGER,
			type: DataTypes.DECIMAL(10, 2),
			allowNull: false,
			defaultValue: 0,
		},
		amount_excluding_tax: {
			// type: DataTypes.INTEGER,
			type: DataTypes.DECIMAL(10, 2),
			allowNull: false,
			defaultValue: 0,
		},
		amount_including_tax: {
			// type: DataTypes.INTEGER,
			type: DataTypes.DECIMAL(10, 2),
			allowNull: false,
			defaultValue: 0,
		},

		payment_status: {
			type: DataTypes.ENUM(
				paymentStatusTypes.PENDING,
				paymentStatusTypes.SUCCESS,
				paymentStatusTypes.REJECTED
			),
			allowNull: false,
			defaultValue: paymentStatusTypes.PENDING,
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
		tableName: "orders",
		timestamps: true,
		underscored: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
	}
);

Order.beforeUpdate(async (order) => {
	order.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});
Order.beforeDestroy(async (order) => {
	order.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
	order.is_active = false;
});

module.exports = Order;
