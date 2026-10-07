const adminController = require('./Admin');
const commonController = require('./Common');
const userController = require('./User');
const estheticianController = require('./Esthetician');

module.exports = {
    ...adminController,
    ...commonController,
    ...userController,
    ...estheticianController,
}