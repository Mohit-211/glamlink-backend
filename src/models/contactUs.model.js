const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');


class ContactUs extends Model { };
ContactUs.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        email: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        subject: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        mobile: {
            type: DataTypes.STRING(50),
            allowNull: true,
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
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
        },
    },
    {
        sequelize,
        tableName: 'contactus',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);

ContactUs.beforeUpdate((contactUs) => {
    contactUs.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

ContactUs.beforeDestroy((contactUs) => {
    contactUs.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    contactUs.is_active = false;
});

module.exports = ContactUs;
