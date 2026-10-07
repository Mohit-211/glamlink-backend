const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");


class BlogCategoryMapping extends Model {}
BlogCategoryMapping.init(
	{
		id: {
			type: DataTypes.INTEGER,
			autoIncrement: true,
			primaryKey: true,
		},
        blog_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            references: {
                model: 'blogs',
                key: 'id',
            },
        },
        blog_category_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'blog_categories',
                key: 'id',
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
		deleted_at: {
			type: DataTypes.DATE,
			allowNull: true,
		},
	},
	{
		sequelize,
		tableName: "blog_category_mapping",
		timestamps: true,
		underscored: true,
		paranoid: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
		deletedAt: "deleted_at",
	}
);

BlogCategoryMapping.beforeUpdate(async (blogCategoryMapping) => {
	blogCategoryMapping.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});
BlogCategoryMapping.beforeDestroy(async (blogCategoryMapping) => {
	blogCategoryMapping.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
	blogCategoryMapping.is_active = false;
});

module.exports = BlogCategoryMapping;
