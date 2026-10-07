const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const slugify = require('slugify');

class BlogCategory extends Model { };
BlogCategory.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        title: {
            type: DataTypes.STRING(200),
            allowNull: false,
        },
        slug: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            onUpdate: Sequelize.literal('CURRENT_TIMESTAMP'),
        },
        deleted_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        sequelize,
        tableName: 'blog_categories',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);

BlogCategory.beforeValidate((blogCategory) => {
    if (blogCategory.title) {
        blogCategory.slug = slugify(blogCategory.title, { lower: true });
    }
});

BlogCategory.beforeUpdate((blogCategory) => {
    blogCategory.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    if (blogCategory.title) {
        blogCategory.slug = slugify(blogCategory.title, { lower: true });
    }
});

BlogCategory.beforeDestroy((blogCategory) => {
    blogCategory.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    blogCategory.is_active = false;
});

module.exports = BlogCategory;
