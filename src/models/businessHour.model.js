/** @format */
const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");

class BusinessHour extends Model {}

BusinessHour.init(
	{
		id: {
			type: DataTypes.BIGINT.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},
	business_card_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: false,
			onDelete: "CASCADE",
			onUpdate: "CASCADE",
			references: {
				model: "business_cards",
				key: "id",
			},
		},

		day: {
			type: DataTypes.STRING,
			allowNull: true,
		},

		open_time: {
			type: DataTypes.STRING,
			allowNull: true,
		},

		close_time: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		note: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		is_closed: {
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
		tableName: "business_hours",
		timestamps: true,
		underscored: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
		deletedAt: "deleted_at",
		paranoid: true,
	},
);

BusinessHour.beforeUpdate(async (hour) => {
	hour.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});

BusinessHour.beforeDestroy(async (hour) => {
	hour.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
	hour.is_active = false;
});

module.exports = BusinessHour;
