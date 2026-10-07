const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class Reel_Tag extends Model { }
Reel_Tag.init({
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
    tableName: 'reel_tags',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

Reel_Tag.beforeUpdate(async (Reel_Tag) => {
    Reel_Tag.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Reel_Tag.beforeDestroy(async (Reel_Tag) => {
    Reel_Tag.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    Reel_Tag.is_active = false;
});

module.exports = Reel_Tag;
