const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const { caseTypes } = require('../config/types');


class Case extends Model { };
Case.init(
    {
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
        status: {
            type: DataTypes.ENUM,
            values: [caseTypes.ACCEPTED, caseTypes.COMPLETED, caseTypes.ONGOING, caseTypes.PENDING, caseTypes.REJECTED,caseTypes.TRIAL],
            defaultValue: caseTypes.ACCEPTED,
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
    },
    {
        sequelize,
        tableName: 'cases',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);


Case.beforeUpdate((Case) => {
    Case.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Case.beforeDestroy((Case) => {
    Case.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    Case.is_active = false;
});

module.exports = Case;
