const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const { appointmentTypes } = require('../config/types');


class BookingSlot extends Model { }
BookingSlot.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    counselor_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
    },
    booking_id: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    remaining_seats : {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    duration: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    date: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    start_time: {
        type: DataTypes.TIME,
        allowNull: false
    },
    end_time: {
        type: DataTypes.TIME,
        allowNull: false
    },
    start_time_local: {
        type: DataTypes.STRING(200),
        allowNull: false,
    },
    end_time_local: {
        type: DataTypes.STRING(200),
        allowNull: false,
    },
    time_zone: {
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
    tableName: 'booking_slots',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

BookingSlot.beforeUpdate(async (bookingSlot) => {
    bookingSlot.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

BookingSlot.beforeDestroy(async (bookingSlot) => {
    bookingSlot.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    bookingSlot.is_active = false;
});

module.exports = BookingSlot;