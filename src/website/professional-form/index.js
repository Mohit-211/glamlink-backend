// The professional application form: questions, answers, approval.

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/form', router: require('./professionalForm.route') },
    ],
};
