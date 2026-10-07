const adminAuthRoute = require('./adminAuth.route');
const adminOpRoute = require('./adminOp.route');
const adminOperationsRoute = require("./adminOperations.route");
const dashboardRoute = require("./dashboard.route");

const adminRoutes = [
    {
        path: '/admin/auth/',
        route: adminAuthRoute,
    },
    {
        path: '/admin/',
        route: adminOpRoute,
    },
    {
        path: '/admin/',
        route: adminOperationsRoute,
    },
    {
        path: '/admin/dashboard',
        route: dashboardRoute,
    },
];

module.exports = adminRoutes;