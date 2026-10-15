// The journal (the magazine) with its categories, topics, FAQs and downloads; authors, podcasts, discover (education, events, shop), ads, blog.

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/journalCategory', router: require('./journalCategory.route') },
        { path: '/author', router: require('./author.route') },
        { path: '/journal', router: require('./journal.route') },
        { path: '/blog-category', router: require('./blogCategory.route') },
        { path: '/blog', router: require('./blog.route') },
        { path: '/podcast-schedule', router: require('./podcastSchedule.route') },
        { path: '/discover', router: require('./discover.route') },
        { path: '/ads', router: require('./ad.route') },
    ],
};
