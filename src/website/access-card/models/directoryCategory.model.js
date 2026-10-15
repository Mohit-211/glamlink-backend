const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../../../core/db/central.db");

class DirectoryCategory extends Model {}
DirectoryCategory.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
		directory_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: false,
		},
		category_id: {
			type: DataTypes.INTEGER,
			allowNull: false,
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
		modelName: 'DirectoryCategories',
		tableName: "directory_categories",
		timestamps: true,
		underscored: true,
		paranoid: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
		deletedAt: "deleted_at",
	},
);

DirectoryCategory.beforeUpdate(async (directoryCategory) => {
	directoryCategory.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});
DirectoryCategory.beforeDestroy(async (directoryCategory) => {
	directoryCategory.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
	directoryCategory.is_active = false;
});

module.exports = DirectoryCategory;
