/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");

class BusinessGalleryMedia extends Model {}

BusinessGalleryMedia.init(
	{
		id: {
			type: DataTypes.BIGINT.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},

		business_card_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: false,
			references: {
				model: "business_cards",
				key: "id",
			},
			onDelete: "CASCADE",
			onUpdate: "CASCADE",
		},

		caption: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		title: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		file_type: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		file_name: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		file_uri: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		file_size: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		thumbnail_uri: {
			type: DataTypes.STRING,
			allowNull: true,
		},
		sort_order: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
		},
		is_thumbnail: {
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
		tableName: "business_gallery_media",
		timestamps: true,
		underscored: true,
		paranoid: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
		deletedAt: "deleted_at",
	},
);

BusinessGalleryMedia.beforeUpdate(async (media) => {
	media.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});

BusinessGalleryMedia.beforeDestroy(async (media) => {
	media.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
	media.is_active = false;
});

module.exports = BusinessGalleryMedia;
