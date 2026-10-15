// The shared/users module's tables.
const Profile = require('./profile.model');
const UserAttachment = require('./userAttachment.model');
const UserAddress = require('./userAddress.model');

// The associations this module owns: the side that holds the foreign key. Called once every module's
// models are loaded (src/models.js), with all of them by name.
const associate = ({ City, Country, State, User }) => {
  User.hasOne(Profile, { foreignKey: "user_id", as: "user_profile" });

  Profile.belongsTo(User, { foreignKey: "user_id", as: "profile_user" });

  User.hasMany(UserAttachment, {
    foreignKey: "user_id",
    as: "user_attachments",
  });

  UserAttachment.belongsTo(User, {
    foreignKey: "user_id",
    as: "attachments_user",
  });

  User.hasMany(UserAttachment, {
    foreignKey: "user_id",
    as: "user_album_attachments",
  });

  UserAttachment.belongsTo(User, {
    foreignKey: "user_id",
    as: "attachments_album_user",
  });


  //User City || User Country
  Profile.belongsTo(State, { foreignKey: "state_id", as: "user_state" });

  Profile.belongsTo(City, { foreignKey: "city_id", as: "user_city" });

  User.hasOne(UserAddress, {
    foreignKey: "user_id",
    as: "user_address",
  });

  UserAddress.belongsTo(Country, {
    foreignKey: "country_id",
    as: "user_country",
  });

  Country.hasMany(UserAddress, {
    foreignKey: "country_id",
    as: "country_user",
  });

  UserAddress.belongsTo(State, { foreignKey: "state_id", as: "user_state" });

  State.hasMany(UserAddress, { foreignKey: "state_id", as: "state_user" });

  UserAddress.belongsTo(City, { foreignKey: "city_id", as: "user_city" });

  City.hasMany(UserAddress, { foreignKey: "city_id", as: "city_user" });
};

module.exports = { models: { Profile, UserAttachment, UserAddress }, associate };
