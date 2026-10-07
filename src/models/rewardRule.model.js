const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const { actionTypesArr } = require('../config/types');

class GlamCoinRule extends Model { }
GlamCoinRule.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    action: {
        type: DataTypes.ENUM,
        values: actionTypesArr,
        allowNull: false
    },
     title: {
        type: DataTypes.STRING(),
        allowNull: true
    },
    coins: {
        type: DataTypes.INTEGER,
        allowNull: false,
        default: 0
    },
    per_user_daily_cap: {
        type: DataTypes.INTEGER,
        default: 0,
    },
    global_daily_cap: {
        type: DataTypes.INTEGER,
        default: 0
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
    tableName: 'glamcoin_rules',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

GlamCoinRule.beforeUpdate(async (profile) => {
    profile.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

GlamCoinRule.beforeDestroy(async (profile) => {
    profile.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    profile.is_active = false;
});

module.exports = GlamCoinRule;
