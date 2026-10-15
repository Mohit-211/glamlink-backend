// App content: FAQs and banners.

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/banner', router: require('./banner.route') },
        { path: '/faq', router: require('./faq.route') },
    ],
};
