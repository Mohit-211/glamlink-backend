const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const { availabilityRuleTypes } = require('../config/types');


class ScheduleRule extends Model { }
ScheduleRule.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    counselor_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        references: {
            model: 'users',
            key: 'id',
        },
    },
    type: {
        type: DataTypes.ENUM,
        values: [availabilityRuleTypes.date, availabilityRuleTypes.wday],
        defaultValue: availabilityRuleTypes.wday,
    },
    day_name_local: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    time_zone: {
        type: DataTypes.STRING(200),
        allowNull: false
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
    tableName: 'rules',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

ScheduleRule.beforeUpdate(async (user) => {
    user.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

ScheduleRule.beforeDestroy(async (user) => {
    user.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    user.is_active = false;
});

module.exports = ScheduleRule;