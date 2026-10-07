const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class PermissionUser extends Model {}


PermissionUser.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    permission_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
    },
    user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true,
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        onUpdate: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    deleted_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
    }
  },
  {
    sequelize,
    tableName: 'permission_user',
    timestamps: true,
    underscored: true,
    paranoid: true,
    'createdAt': 'created_at',
    'updatedAt': 'updated_at',
    'deletedAt': 'deleted_at'
  }
);

PermissionUser.beforeUpdate(async (permissionUser) => {
    permissionUser.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

PermissionUser.beforeDestroy(async (permissionUser) => {
    permissionUser.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    permissionUser.is_active = false;
});

module.exports = PermissionUser;
