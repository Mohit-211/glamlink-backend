/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");

class OrderParcelDetails extends Model {}

OrderParcelDetails.init(
	{
		id: {
			type: DataTypes.BIGINT.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
		order_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: false,
		},
		length: {
			type: DataTypes.FLOAT,
			allowNull: false,
			defaultValue: 1,
		},
		width: {
			type: DataTypes.FLOAT,
			allowNull: false,
		},
		height: {
			type: DataTypes.FLOAT,
			allowNull: false,
			defaultValue: 0,
		},
		weight: {
			type: DataTypes.FLOAT,
			allowNull: false,
			defaultValue: 0,
		},
		distance_unit: {
			type: DataTypes.STRING,
			allowNull: false,
			defaultValue: 0,
		},
		mass_unit: {
			type: DataTypes.STRING,
			allowNull: false,
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
	},
	{
		sequelize,
		tableName: "order_parcel_details",
		timestamps: true,
		underscored: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
	}
);

OrderParcelDetails.beforeUpdate(async (OrderParcelDetails) => {
	OrderParcelDetails.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});
OrderParcelDetails.beforeDestroy(async (OrderParcelDetails) => {
	OrderParcelDetails.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
	OrderParcelDetails.is_active = false;
});

module.exports = OrderParcelDetails;
