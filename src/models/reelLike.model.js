const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class ReelLike extends Model { };
ReelLike.init(
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
        reel_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            references: {
                model: 'reels',
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
        tableName: 'reel_likes',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);

ReelLike.beforeUpdate((ReelLike) => {
    ReelLike.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

ReelLike.beforeDestroy((ReelLike) => {
    ReelLike.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    ReelLike.is_active = false;
});

module.exports = ReelLike;
