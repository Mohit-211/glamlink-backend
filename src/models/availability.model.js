const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class Availability extends Model { }
Availability.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    counselor_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
    },
    day_name: {
        type: DataTypes.ENUM,
        values: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        allowNull: false
    },
    maximum_available_seats: {
        type: DataTypes.INTEGER,
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
    duration: {
        type: DataTypes.INTEGER,
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
    tableName: 'availability',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

Availability.beforeUpdate(async (availability) => {
    availability.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Availability.beforeDestroy(async (availability) => {
    availability.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    availability.is_active = false;
});

module.exports = Availability;