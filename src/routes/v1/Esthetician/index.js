const schedularRoute = require('./schedular.route');

const customerRoutes = [
    {
        path: '/counselor/schedular/',
        route: schedularRoute,
    },
];

module.exports = customerRoutes;