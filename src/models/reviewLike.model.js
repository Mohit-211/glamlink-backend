const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class ReviewLike extends Model { };
ReviewLike.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id',
            },
        },
        review_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'reviews',
                key: 'id',
            },
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
        tableName: 'review_likes',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);


ReviewLike.beforeUpdate((ReviewLike) => {
    ReviewLike.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

ReviewLike.beforeDestroy((ReviewLike) => {
    ReviewLike.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    ReviewLike.is_active = false;
});

module.exports = ReviewLike;
