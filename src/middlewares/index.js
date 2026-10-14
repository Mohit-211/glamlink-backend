const adminAuthMiddleware = require('./adminAuth.middleware');
const userAuthMiddleware = require('./userAuth.middleware');
const schedularMiddleware = require('./schedulat.middleware');
const postMiddleware = require('./post.middleware');
const apointmentMiddleware = require('./apointment.middleware');
const accessMiddleware = require('./access.middleware');

module.exports = {
    adminAuthMiddleware,
    userAuthMiddleware,
    schedularMiddleware,
    postMiddleware,
    apointmentMiddleware,
    accessMiddleware,
}