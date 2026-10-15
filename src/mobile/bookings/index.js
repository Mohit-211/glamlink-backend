// Services and their categories, availability and scheduling, appointments, cases.

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/category', router: require('./category.route') },
        { path: '/service', router: require('./service.route') },
        { path: '/appointment', router: require('./appointment.route') },
        { path: '/case', router: require('./case.route') },
        { path: '/professional/scheduler/', router: require('./scheduler.route') },
    ],
};
