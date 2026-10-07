const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const { v4: uuidv4 } = require('uuid');

class Review extends Model { };
Review.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: () => uuidv4(),
            primaryKey: true,
            allowNull: false,
        },
        text: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        counselor_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
            // onDelete: 'CASCADE',
            // onUpdate: 'CASCADE',
            // references: {
            //     model: 'users',
            //     key: 'id',
            // },
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
        level: {
            type: DataTypes.ENUM('0', '1', '2', '3', '4', '5'),
            defaultValue: '0'
        },
        likes_count: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        is_remove_request_raised: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
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
        tableName: 'reviews',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);


Review.beforeUpdate((Review) => {
    Review.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Review.beforeDestroy((Review) => {
    Review.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    Review.is_active = false;
});

module.exports = Review;
