const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const { appointmentTypes, callTypes, rolesTypes } = require('../config/types');



class Appointment extends Model { }
Appointment.init({
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
    user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        references: {
            model: 'users',
            key: 'id',
        },
    },
    case_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        references: {
            model: 'cases',
            key: 'id',
        },
    },
    service_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        // onDelete: 'CASCADE',
        // onUpdate: 'CASCADE',
        // references: {
        //     model: 'services',
        //     key: 'id',
        // },
    },
    slot_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        references: {
            model: 'slots',
            key: 'id',
        },
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    total_amount: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    slot_duration_in_minuites: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    cancelation_reason: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    reschedule_text: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM,
        values: [appointmentTypes.ACCEPTED, appointmentTypes.PENDING, 
            appointmentTypes.REJECTED, appointmentTypes.RESCHEDULED, 
            appointmentTypes.CANCELED, appointmentTypes.COMPLETED,
            appointmentTypes.ONGOING],
        defaultValue: appointmentTypes.PENDING,
    },
    timing_status: {
        type: DataTypes.ENUM,
        values: [ appointmentTypes.COMPLETED, appointmentTypes.ONGOING, appointmentTypes.UPCOMING, appointmentTypes.CANCELED,],
        defaultValue: appointmentTypes.UPCOMING,
    },
    is_counselor_joined: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_user_joined: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_notification_send: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_term_form_accepted_by_user: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    is_user_canceled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_counselor_canceled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_payment_done: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_rescheduled_done: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_refund_needed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    call_type: {
        type: DataTypes.ENUM,
        values: [callTypes.VIDEO, callTypes.VOICE],
        defaultValue: callTypes.VIDEO,
    },
    counselor_zego_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    user_zego_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    zego_call_id : {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    call_end_by: {
        type: DataTypes.ENUM,
        values: [rolesTypes.User, rolesTypes.CLLR],
        allowNull: true,
    },
    call_start_time:{
        type: DataTypes.DATE,
        allowNull: true
    },
    call_end_time: {
        type: DataTypes.DATE,
        allowNull: true
    },
    call_duration_in_minuites: {
        type: DataTypes.INTEGER,
        allowNull: true,
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
    tableName: 'appointments',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

Appointment.beforeUpdate(async (user) => {
    user.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Appointment.beforeDestroy(async (user) => {
    user.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    user.is_active = false;
});

module.exports = Appointment;