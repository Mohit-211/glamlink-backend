// The mobile/glamcoins module's tables.
const GlamCoinRule = require('./glamCoinRule.model');
const UserGlamCoinEvent = require('./userGlamcoinEvent.model');

const associate = () => {};

module.exports = { models: { GlamCoinRule, UserGlamCoinEvent }, associate };
