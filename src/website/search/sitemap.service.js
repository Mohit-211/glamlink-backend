// The sitemap feed (GET /sitemap): every public page's id, slug and date of last change, by kind, so the website's
// sitemap needs no full lists. Each kind follows its own rules for what is public (those of its list and its page).
const { sitemapArticles, sitemapTopics, sitemapProducts } = require('../content');
const { sitemapPages } = require('../profiles');
const { sitemapVideos } = require('../watch');
const { sitemapIssues } = require('../magazine');

const KINDS = {
    articles: sitemapArticles,
    topics: sitemapTopics,
    profiles: sitemapPages,
    products: sitemapProducts,
    videos: sitemapVideos,
    issues: sitemapIssues,
};

const sitemap = async () => {
    const names = Object.keys(KINDS);
    const lists = await Promise.all(names.map((name) => KINDS[name]()));
    return Object.fromEntries(names.map((name, i) => [name, lists[i]]));
};

module.exports = { sitemap };
