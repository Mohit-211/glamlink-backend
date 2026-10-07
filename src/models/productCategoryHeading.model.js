const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const slugify = require('slugify');

class ProductCategoryHeading extends Model { };
ProductCategoryHeading.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
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
        tableName: 'product_categorie_headings',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);

ProductCategoryHeading.beforeValidate((ProductCategoryHeading) => {
    if (ProductCategoryHeading.title) {
        ProductCategoryHeading.slug = slugify(ProductCategoryHeading.title, { lower: true });
    }
});

ProductCategoryHeading.beforeUpdate((ProductCategoryHeading) => {
    ProductCategoryHeading.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    if (ProductCategoryHeading.title) {
        ProductCategoryHeading.slug = slugify(ProductCategoryHeading.title, { lower: true });
    }
});

ProductCategoryHeading.beforeDestroy((ProductCategoryHeading) => {
    ProductCategoryHeading.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    ProductCategoryHeading.is_active = false;
});

module.exports = ProductCategoryHeading;
