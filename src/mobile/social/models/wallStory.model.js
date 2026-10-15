const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

class WallStory extends Model { }
WallStory.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    story_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        unique : false,
        references: {
            model: 'stories',
            key: 'id',
        },
    },
    wall_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        references: {
            model: 'walls',
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
        allowNull: true,
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
    }
}, {
    sequelize,
    modelName: 'Wall_Story',
    tableName: 'wall_stories',
    timestamps: true,
    underscored: true,
    paranoid: true,
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    'deletedAt': 'deleted_at'
});

WallStory.beforeUpdate(async (WallStory) => {
    WallStory.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

WallStory.beforeDestroy(async (WallStory) => {
    WallStory.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    WallStory.is_active = false;
});

module.exports = WallStory;
