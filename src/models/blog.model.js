const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const slugify = require('slugify');

class Blog extends Model { };
Blog.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
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
        created_by: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            references: {
                model: 'admins',
                key: 'id',
            },
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
        tableName: 'blogs',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);

Blog.beforeValidate((blog) => {
    if (blog.title) {
        blog.slug = slugify(blog.title, { lower: true });
    }
});

Blog.beforeUpdate((blog) => {
    blog.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Blog.beforeDestroy((blog) => {
    blog.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    blog.is_active = false;
});

module.exports = Blog;
