// The shared/identity module's tables.
const User = require('./user.model');
const AuthSession = require('./authSession.model');
const EmailToken = require('./emailToken.model');
const UserIdentity = require('./userIdentity.model');
const UserToken = require('./userToken.model');
const OTP = require('./otp.model');
const UserLoginTiming = require('./userLoginTiming.model');

// The associations this module owns: the side that holds the foreign key. Called once every module's
// models are loaded (src/models.js), with all of them by name.
const associate = ({ Profile, Role, Timezone }) => {
  Role.hasMany(User, { foreignKey: "role_id", as: "role_users" });

  User.belongsTo(Role, { foreignKey: "role_id", as: "user_role" });

  User.hasMany(UserToken, { foreignKey: "user_id", as: "user_tokens" });

  User.hasMany(AuthSession, { foreignKey: "user_id", as: "auth_sessions" });

  AuthSession.belongsTo(User, { foreignKey: "user_id", as: "user" });

  User.hasMany(EmailToken, { foreignKey: "user_id", as: "email_tokens" });

  EmailToken.belongsTo(User, { foreignKey: "user_id", as: "user" });

  User.hasMany(UserIdentity, { foreignKey: "user_id", as: "identities" });

  UserIdentity.belongsTo(User, { foreignKey: "user_id", as: "user" });

  UserToken.belongsTo(User, { foreignKey: "user_id", as: "token_user" });

  UserToken.belongsTo(Profile, {
    foreignKey: "user_id",
    as: "token_user_profile",
    sourceKey: "user_id",
  });

  UserLoginTiming.belongsTo(User, { foreignKey: "user_id", as: "login_user" });

  UserLoginTiming.belongsTo(Timezone, {
    foreignKey: "time_zone",
    as: "login_user_timezone",
  });

  User.belongsTo(User, {
    as: "referrer", // alias for the professional who referred
    foreignKey: "referred_by",
  });

  User.hasMany(User, {
    as: "referrals", // alias for users they referred
    foreignKey: "referred_by",
  });
};

module.exports = { models: { User, AuthSession, EmailToken, UserIdentity, UserToken, OTP, UserLoginTiming }, associate };
