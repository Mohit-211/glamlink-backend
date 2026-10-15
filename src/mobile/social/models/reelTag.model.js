const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

class ReelTag extends Model { }
ReelTag.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    reel_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
            model: 'reels',
            key: 'id',
        },
    },
    tag_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        references: {
            model: 'tags',
            key: 'id',
        },
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
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
    }
}, {
    sequelize,
    modelName: 'Reel_Tag',
    tableName: 'reel_tags',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

ReelTag.beforeUpdate(async (ReelTag) => {
    ReelTag.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

ReelTag.beforeDestroy(async (ReelTag) => {
    ReelTag.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    ReelTag.is_active = false;
});

module.exports = ReelTag;
