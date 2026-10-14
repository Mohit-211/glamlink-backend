const { DataTypes, Model } = require('sequelize');
const sequelize = require('../core/db/central.db');

// A signed-in device. The refresh token rotates on every use; only hashes are stored.
class AuthSession extends Model {}

AuthSession.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
    },
    refresh_token_hash: {
        type: DataTypes.CHAR(64),
        allowNull: false,
    },
    // The token this one replaced, to recognise a stolen token being replayed.
    previous_token_hash: {
        type: DataTypes.CHAR(64),
        allowNull: true,
    },
    rotated_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    // website | app
    client: {
        type: DataTypes.STRING(20),
        allowNull: true,
    },
    // The app's Firebase push token for this device
    push_token: {
        type: DataTypes.STRING(500),
        allowNull: true,
    },
    user_agent: {
        type: DataTypes.STRING(500),
        allowNull: true,
    },
    ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
    },
    last_used_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    expires_at: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    revoked_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    revoke_reason: {
        type: DataTypes.STRING(50),
        allowNull: true,
    },
}, {
    sequelize,
    tableName: 'auth_sessions',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false,
});

module.exports = AuthSession;
