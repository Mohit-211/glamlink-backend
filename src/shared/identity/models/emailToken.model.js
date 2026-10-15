const { DataTypes, Model } = require('sequelize');
const sequelize = require('../../../core/db/central.db');

// A single-use link sent by email (verify the address, reset the password). Only the hash is stored.
class EmailToken extends Model {}

EmailToken.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
    },
    purpose: {
        type: DataTypes.ENUM('verify_email', 'reset_password'),
        allowNull: false,
    },
    token_hash: {
        type: DataTypes.CHAR(64),
        allowNull: false,
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    used_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
}, {
    sequelize,
    tableName: 'email_tokens',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
});

module.exports = EmailToken;
