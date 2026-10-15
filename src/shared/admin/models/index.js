// The shared/admin module's tables.
const Admin = require('./admin.model');
const Role = require('./role.model');
const Department = require('./department.model');
const Permission = require('./permission.model');
const PermissionUser = require('./permissionUser.model');

// The associations this module owns: the side that holds the foreign key. Called once every module's
// models are loaded (src/models.js), with all of them by name.
const associate = () => {

  // Department
  Department.hasMany(Admin, {
    foreignKey: "department_id",
    as: "department_admins",
  });

  Admin.belongsTo(Department, {
    foreignKey: "department_id",
    as: "admin_department",
  });


  // User
  Role.hasMany(Admin, { foreignKey: "role_id", as: "role_admins" });

  Admin.belongsTo(Role, { foreignKey: "role_id", as: "admin_role" });


  // ACl Permission
  Permission.hasMany(PermissionUser, {
    foreignKey: "permission_id",
    as: "permission_permission_user",
  });

  PermissionUser.belongsTo(Permission, {
    foreignKey: "permission_id",
    as: "permission_user_permission",
  });

  Permission.hasMany(Permission, { foreignKey: "parent_id", as: "children" });
};

module.exports = { models: { Admin, Role, Department, Permission, PermissionUser }, associate };
