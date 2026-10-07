const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const { userStatusTypes } = require('../config/types');

class BrandAssociation extends Model { };
BrandAssociation.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
        },
        brand_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
        },
		status: {
			type: DataTypes.ENUM,
			values: [
				userStatusTypes.ACCEPTED,
				userStatusTypes.PENDING,
				userStatusTypes.REJECTED,
			],
			defaultValue: userStatusTypes.PENDING,
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
        tableName: 'brand_associations',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);




BrandAssociation.beforeUpdate((BrandAssociation) => {
    BrandAssociation.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

BrandAssociation.beforeDestroy((BrandAssociation) => {
    BrandAssociation.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    BrandAssociation.is_active = false;
});

module.exports = BrandAssociation;
