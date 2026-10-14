const { Sequelize } = require('sequelize');
const config = require('../config/config.js');
const logger = require('../logger.js');

const sequelizeOptions = {
    host: config.databases.central.host,
    dialect: 'mysql',
    supportBigNumbers: true,
    // Production is MariaDB, where JSON columns are text with a json_valid check. mysql2 >= 3.23 parses
    // them into objects; the code (and the website's API responses) expect strings, so keep them as strings.
    dialectOptions: { jsonStrings: true },
    collate: 'utf8mb4_unicode_ci',
    pool: {
        max: 10,
        min: 0,
        idle: 10000,
    },
    logging: config.env === 'production' ? false : console.log
};

//create connection object
const sequelize = new Sequelize(
    config.databases.central.db,
    config.databases.central.user,
    config.databases.central.passwd,
    sequelizeOptions,
);

sequelize.authenticate()
    .then(() => logger.info('Primary Database Connection has been established successfully😊.'))
    .catch((error) => logger.warn('Unable to connect to the Primary Database🥺 :', error));


module.exports = sequelize;
