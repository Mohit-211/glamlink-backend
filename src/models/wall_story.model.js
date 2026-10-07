const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class Wall_Story extends Model { }
Wall_Story.init({
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
    tableName: 'wall_stories',
    timestamps: true,
    underscored: true,
    paranoid: true,
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    'deletedAt': 'deleted_at'
});

Wall_Story.beforeUpdate(async (Wall_Story) => {
    Wall_Story.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Wall_Story.beforeDestroy(async (Wall_Story) => {
    Wall_Story.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    Wall_Story.is_active = false;
});

module.exports = Wall_Story;
