const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const { availabilityRuleTypes } = require('../config/types');


class RuleInterval extends Model { }
RuleInterval.init({
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
    rule_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        references: {
            model: 'rules',
            key: 'id',
        },
    },
    week_no: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    month_no: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    year : {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    from: {
        type: DataTypes.TIME,
        allowNull: false
    },
    maximum_available_seats : {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    to: {
        type: DataTypes.TIME,
        allowNull: false
    },
    duration_in_minuites: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    slot_division_in_minuites: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    time_offset: {
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
    tableName: 'intervals',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

RuleInterval.beforeUpdate(async (user) => {
    user.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

RuleInterval.beforeDestroy(async (user) => {
    user.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    user.is_active = false;
});

module.exports = RuleInterval;