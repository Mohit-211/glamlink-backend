// The journal (the magazine) with its categories, topics, FAQs and downloads; authors, podcasts, discover (education, events, shop), ads, blog.

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes. `refresh`: the website's data their changes touch
    // (its cache-refresh hook).
    routes: () => [
        { path: '/journalCategory', router: require('./journalCategory.route'), refresh: ['journal'] },
        { path: '/author', router: require('./author.route'), refresh: ['journal'] },
        { path: '/journal', router: require('./journal.route'), refresh: ['journal', 'topics'] },
        { path: '/blog-category', router: require('./blogCategory.route'), refresh: ['blog'] },
        { path: '/blog', router: require('./blog.route'), refresh: ['blog'] },
        { path: '/podcast-schedule', router: require('./podcastSchedule.route'), refresh: ['podcasts'] },
        { path: '/discover', router: require('./discover.route'), refresh: ['shop', 'discover'] },
        { path: '/ads', router: require('./ad.route'), refresh: ['ads'] },
        { path: '/settings', router: require('./siteSettings.route'), refresh: ['home'] },
        { path: '/my/products', router: require('./myProducts.route'), refresh: ['shop'] },
    ],
    // For other modules (loaded when called, so this file stays light):
    // the published products an account owns or makes, as { count, rows } (rows as the shop lists them).
    productsOfAccount: (userId, query) => require('./discover.service').productsOfAccount(userId, query),
    // the published articles that feature an account, as { count, rows } of article cards.
    articlesOfAccount: (userId, query) => require('./journal.service').articlesOfAccount(userId, query),
    // the site-wide search's groups: { count, rows } with exact matches first.
    searchTopics: (options) => require('./journal.service').searchTopics(options),
    searchArticles: ({ q, limit, offset }) => require('./journal.service').listJournals({ search: q, limit, page: offset / limit + 1 }, { rank: true }),
    searchProducts: ({ q, limit, offset }) => require('./discover.service').listShop({ search: q, limit, page: offset / limit + 1 }, { rank: true }),
    // the sitemap's published articles, topics and published products: [{ id, slug, updated_at }].
    sitemapArticles: () => require('./journal.service').sitemapArticles(),
    sitemapTopics: () => require('./journal.service').sitemapTopics(),
    sitemapProducts: () => require('./discover.service').sitemapProducts(),
    // For data migrations: the @handles in an article's HTML.
    handlesIn: require('./mentionText').handlesIn,
};
