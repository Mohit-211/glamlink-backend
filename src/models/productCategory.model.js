const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const slugify = require('slugify');

class ProductCategory extends Model { };
ProductCategory.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        category_id: {
			type: DataTypes.INTEGER,
			  allowNull: true,
		},
        title: {
            type: DataTypes.STRING(200),
            allowNull: false,
        },
        slug: {
            type: DataTypes.STRING,
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
        tableName: 'product_categories',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);

ProductCategory.beforeValidate((productCategory) => {
    if (productCategory.title) {
        productCategory.slug = slugify(productCategory.title, { lower: true });
    }
});

ProductCategory.beforeUpdate((productCategory) => {
    productCategory.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    if (productCategory.title) {
        productCategory.slug = slugify(productCategory.title, { lower: true });
    }
});

ProductCategory.beforeDestroy((productCategory) => {
    productCategory.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    productCategory.is_active = false;
});

module.exports = ProductCategory;
