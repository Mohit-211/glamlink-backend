const adminAuthMiddleware = require('./adminAuth.middleware');
const roleMiddleware = require('./role.middleware');
const userAuthMiddleware = require('./userAuth.middleware');
const commonMiddleware = require('./common.middleware');
const schedularMiddleware = require('./schedulat.middleware');
const postMiddleware = require('./post.middleware');
const apointmentMiddleware = require('./apointment.middleware');

module.exports = {
    adminAuthMiddleware,
    roleMiddleware,
    userAuthMiddleware,
    commonMiddleware,
    schedularMiddleware,
    postMiddleware,
    apointmentMiddleware
}