/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");

class BusinessLocation extends Model {}

BusinessLocation.init(
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

		label: {
			type: DataTypes.STRING,
			allowNull: true,
		},

		location_type: {
			type: DataTypes.ENUM("exact_address", "city_only"),
			allowNull: false,
		},

		address: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		city: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		state: {
			type: DataTypes.STRING,
			allowNull: true,
		},

		business_name: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		phone: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		description: {
			type: DataTypes.TEXT,
			allowNull: true,
		},
		latitude: {
			type: DataTypes.DECIMAL(10, 6),
			allowNull: true,
		},

		longitude: {
			type: DataTypes.DECIMAL(11, 6),
			allowNull: true,
		},
		is_primary: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
		},
		is_thumbnail: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
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
		tableName: "business_locations",
		timestamps: true,
		underscored: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
		deletedAt: "deleted_at",
		paranoid: true,
	},
);

BusinessLocation.beforeUpdate(async (location) => {
	location.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});

BusinessLocation.beforeDestroy(async (location) => {
	location.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
	location.is_active = false;
});

module.exports = BusinessLocation;
