const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class Post extends Model { };
Post.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: true,
            validate: {
                maxLength: function (value) {
                    if (value && value.length > 2000) {
                        throw new Error('Content must be at most 150 characters');
                    }
                },
            },
        },
        user_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id',
            },
        },
        likes_count: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue : 0
        },
        comment_count: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue : 0
        },
        report_count: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue : 0
        },
        type: {
            type: DataTypes.STRING(50),
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
        tableName: 'posts',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);


Post.beforeUpdate((Post) => {
    Post.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Post.beforeDestroy((Post) => {
    Post.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    Post.is_active = false;
});

module.exports = Post;
