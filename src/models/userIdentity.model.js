const { DataTypes, Model } = require('sequelize');
const sequelize = require('../core/db/central.db');

// An external sign-in (Google; Apple accounts from the old app) linked to an account.
class UserIdentity extends Model {}

UserIdentity.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
    },
    provider: {
        type: DataTypes.ENUM('google', 'apple'),
        allowNull: false,
    },
    // The provider's stable id for the person (Google "sub")
    provider_user_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
}, {
    sequelize,
    tableName: 'user_identities',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
});

module.exports = UserIdentity;
