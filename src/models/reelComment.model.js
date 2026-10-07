const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class ReelComment extends Model { };
ReelComment.init(
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
        comment: {
            type: DataTypes.STRING,
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
        tableName: 'reel_comments',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);


ReelComment.beforeUpdate((ReelComment) => {
    ReelComment.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

ReelComment.beforeDestroy((ReelComment) => {
    ReelComment.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    ReelComment.is_active = false;
});

module.exports = ReelComment;
