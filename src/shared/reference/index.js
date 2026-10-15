// Reference lists: countries, states, cities, languages, professions.

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/country', router: require('./country.route') },
        { path: '/state', router: require('./state.route') },
        { path: '/city', router: require('./city.route') },
        { path: '/language', router: require('./language.route') },
        { path: '/profession', router: require('./profession.route') },
    ],
};
