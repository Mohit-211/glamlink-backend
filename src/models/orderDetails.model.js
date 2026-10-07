/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");
const { orderTypes } = require("../config/types");

class OrderDetails extends Model {}

OrderDetails.init(
	{
		id: {
			type: DataTypes.BIGINT.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		order_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: false,
			onDelete: "CASCADE",
			onUpdate: "CASCADE",
		},
		product_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: false,
		},
		user_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: false,
		},
		professional_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: true,
		},
		total_items: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 1,
		},
		total_price: {
			type: DataTypes.DECIMAL(10, 2),
			allowNull: false,
			defaultValue: 0,
		},
		tax_amount: {
			type: DataTypes.DECIMAL(10, 2),
			allowNull: false,
			defaultValue: 0,
		},
		amount_excluding_tax: {
			type: DataTypes.DECIMAL(10, 2),
			allowNull: false,
			defaultValue: 0,
		},
		amount_including_tax: {
			type: DataTypes.DECIMAL(10, 2),
			allowNull: false,
			defaultValue: 0,
		},
		platform_fees: {
			type: DataTypes.DECIMAL(10, 2),
			allowNull: false,
			defaultValue: 0,
		},

		payout_status: {
			type: DataTypes.ENUM("PENDING", "COMPLETED"),
			defaultValue: "PENDING",
		},
		payout_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: true,
		},
		order_status: {
			type: DataTypes.ENUM,
			values: [
				orderTypes.PLACED,
				orderTypes.CONFIRMED,
				orderTypes.PROCESSING,
				orderTypes.AWAITING_SHIPMENT,
				orderTypes.SHIPPED,
				orderTypes.OUT_FOR_DELIVERY,
				orderTypes.DELIVERED,
				orderTypes.FAILED_DELIVERY,
				orderTypes.RETURN_REQUESTED,
				orderTypes.RETURNED,
				orderTypes.REFUNDED,
				orderTypes.CANCELLED,
			],
			defaultValue: orderTypes.PLACED,
		},

		shippo_required: {
			type: DataTypes.BOOLEAN,
			allowNull: false,
			defaultValue: false,
		},
		shippo_shipment_id: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		shippo_rate_id: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		shippo_label_url: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		shippo_tracking_number: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		shippo_tracking_url: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		shippo_label_file_type: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		shippo_parcel_id: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		shippo_transaction_id: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		shippo_shipment_cost: {
			type: DataTypes.DECIMAL(10, 2),
			allowNull: true,
		},
		shippo_shipment_currency: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		shippo_error_messages: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		tracking_link: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		estimated_date: {
			type: DataTypes.DATE,
			allowNull: true,
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
		tableName: "order_details",
		timestamps: true,
		underscored: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
	}
);

OrderDetails.beforeUpdate(async (orderDetails) => {
	orderDetails.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});
OrderDetails.beforeDestroy(async (orderDetails) => {
	orderDetails.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
	orderDetails.is_active = false;
});

module.exports = OrderDetails;
