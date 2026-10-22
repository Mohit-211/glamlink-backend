const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');
const { toSlug } = require('../../../core/utils/slug');

class JournalCategory extends Model { };
JournalCategory.init(
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
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        // The order of the Journal page's category list.
        sort_order: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
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
        tableName: 'journal_categories',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);

// The title without stray spaces, and the slug the website filters by made from it.
const tidy = (journalCategory) => {
    if (journalCategory.title) {
        journalCategory.title = journalCategory.title.trim();
        journalCategory.slug = toSlug(journalCategory.title);
    }
};

JournalCategory.beforeValidate(tidy);

JournalCategory.beforeUpdate((journalCategory) => {
    journalCategory.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    tidy(journalCategory);
});

JournalCategory.beforeDestroy((journalCategory) => {
    journalCategory.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    journalCategory.is_active = false;
});

module.exports = JournalCategory;
