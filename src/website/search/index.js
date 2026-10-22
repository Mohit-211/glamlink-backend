// Site-wide: the search (topics, professionals, brands, products, articles and videos in one call) and the sitemap
// feed (every public page's slug and date of last change).

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/search', router: require('./search.route') },
        { path: '/sitemap', router: require('./sitemap.route') },
    ],
};
