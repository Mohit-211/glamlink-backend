// The shared/reference module's tables.
const Country = require('./country.model');
const State = require('./state.model');
const City = require('./city.model');
const Timezone = require('./timezone.model');
const Language = require('./language.model');
const Profession = require('./profession.model');

// The associations this module owns: the side that holds the foreign key. Called once every module's
// models are loaded (src/models.js), with all of them by name.
const associate = () => {
  // Country
  Country.hasMany(State, { foreignKey: "country_id", as: "all_state" });

  State.belongsTo(Country, { foreignKey: "country_id", as: "country" });

  Country.hasMany(City, { foreignKey: "country_id", as: "all_city" });

  City.belongsTo(Country, { foreignKey: "country_id", as: "country" });


  // State
  State.hasMany(City, { foreignKey: "state_id", as: "all_city" });

  City.belongsTo(State, { foreignKey: "state_id", as: "state" });
};

module.exports = { models: { Country, State, City, Timezone, Language, Profession }, associate };
