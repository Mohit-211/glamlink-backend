const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const { appointmentTypes } = require('../config/types');


class Slot extends Model { }
Slot.init({
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
    interval_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        references: {
            model: 'intervals',
            key: 'id',
        },
    },
    remaining_appointment : {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    slot_duration_in_minuites: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    slot_date_local: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    slot_start_time_local: {
        type: DataTypes.TIME,
        allowNull: false
    },
    slot_end_time_local: {
        type: DataTypes.TIME,
        allowNull: false
    },
    time_zone: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    day_no_local: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    day_name_local: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    week_no_local: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    month_no_local: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    month_name_local: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    time_offset: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    is_available: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    is_booked: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
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
    tableName: 'slots',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

Slot.beforeUpdate(async (user) => {
    user.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Slot.beforeDestroy(async (user) => {
    user.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    user.is_active = false;
});

module.exports = Slot;