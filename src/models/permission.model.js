const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class Permission extends Model { }


Permission.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    menu_type: {
      type: DataTypes.STRING(100),
      defaultValue: 'backend',
    },
    permission_slug: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    label: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    url_type: {
      type: DataTypes.STRING(50),
      defaultValue: 'route',
    },
    url: {
      type: DataTypes.STRING(255),
      defaultValue: null,
    },
    parent_id: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    priority: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      defaultValue: null,
    },
    updated_by: {
      type: DataTypes.INTEGER.UNSIGNED,
      defaultValue: null,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      onUpdate: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'permissions',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  }
);

Permission.beforeUpdate(async (permission) => {
  permission.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Permission.beforeDestroy(async (permission) => {
  permission.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
  permission.is_active = false;
});

module.exports = Permission;
