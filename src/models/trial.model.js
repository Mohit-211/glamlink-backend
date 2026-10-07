const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const { appointmentTypes, callTypes, rolesTypes } = require('../config/types');

class Trial extends Model { }
Trial.init({
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
    date_local: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    start_time_local: {
        type: DataTypes.TIME,
        allowNull: true
    },
    time_zone: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    cancelation_reason: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    is_user_canceled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_counselor_canceled: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    status: {
        type: DataTypes.ENUM,
        values: [appointmentTypes.ACCEPTED, appointmentTypes.PENDING, 
            appointmentTypes.REJECTED, appointmentTypes.CANCELED, 
            appointmentTypes.COMPLETED, appointmentTypes.ONGOING],
        defaultValue: appointmentTypes.PENDING,
    },
    is_counselor_joined: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    is_user_joined: {
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
    call_duration_in_minuites: {
        type: DataTypes.INTEGER,
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
    tableName: 'trails',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

Trial.beforeUpdate(async (trial) => {
    trial.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Trial.beforeDestroy(async (trial) => {
    trial.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    trial.is_active = false;
});

module.exports = Trial;