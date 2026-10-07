const adminService = require('./Admin');
const commonService = require('./Common');
const userService = require('./User');
const estheticianService = require('./Esthetician');

module.exports = {
    ...adminService,
    ...commonService,
    ...userService,
    ...estheticianService,
}
