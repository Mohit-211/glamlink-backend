// Notifications: the list and push.
const { createNotification } = require('./notification.service');

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/notification', router: require('./notification.route') },
    ],
    // For other modules.
    createNotification,
};
