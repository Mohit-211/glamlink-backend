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
    counselor_availability_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        references: {
            model: 'counselor_availability',
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
    slot_start_date_utc: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    slot_start_date_local: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    slot_end_date_utc: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    slot_end_date_local: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    slot_start_time_utc: {
        type: DataTypes.TIME,
        allowNull: false
    },
    slot_end_time_utc: {
        type: DataTypes.TIME,
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
    start_day_no_utc: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    start_day_no_local: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    end_day_no_utc: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    end_day_no_local: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    start_day_name_utc: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    start_day_name_local: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    end_day_name_utc: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    end_day_name_local: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    start_week_no_utc: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    start_week_no_local: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    end_week_no_utc: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    end_week_no_local: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    start_month_no_utc: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    start_month_no_local: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    end_month_no_utc: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    end_month_no_local: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    start_month_name_utc: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    start_month_name_local: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    end_month_name_utc: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    end_month_name_local: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    start_year_utc: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    start_year_local: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    end_year_utc: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    end_year_local: {
        type: DataTypes.INTEGER,
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
    is_daylight_offset: {
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