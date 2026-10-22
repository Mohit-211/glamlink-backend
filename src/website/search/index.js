// The site-wide search: topics, professionals, brands, products, articles and videos in one call.

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/search', router: require('./search.route') },
    ],
};
