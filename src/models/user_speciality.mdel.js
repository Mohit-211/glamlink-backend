const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class User_Speciality extends Model {}
User_Speciality.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
        onDelete:'CASCADE',
        onUpdate: 'CASCADE',
        references: {
            model: 'users',
            key: 'id',
        },
    },
    speciality_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        onDelete:'CASCADE',
        onUpdate: 'CASCADE',
        references: {
          model: 'specialities',
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        onUpdate: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
    }
}, {
    sequelize,
    tableName: 'user_specialities',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

User_Speciality.beforeUpdate(async (User_Speciality) => {
    User_Speciality.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

User_Speciality.beforeDestroy(async (User_Speciality) => {
    User_Speciality.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    User_Speciality.is_active = false;
});

module.exports = User_Speciality;
