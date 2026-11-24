// Watch: videos by series (Beauty Vault Podcast, Expert Take, Treatment Spotlight, Industry Voices), stored on the
// server and imported from each series' YouTube playlist when an admin asks (POST /videos/admin/sync: new episodes
// come rarely, so nothing polls YouTube on a clock); the people in them and their topics.
module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes. `refresh`: the website's data their changes touch
    // (its cache-refresh hook).
    routes: () => [
        { path: '/videos', router: require('./video.route'), refresh: ['videos'] },
        { path: '/video-series', router: require('./videoSeries.route'), refresh: ['videos'] },
    ],
    // For other modules (loaded when called, so this file stays light):
    // the published videos an account appears in, as { count, rows } of video cards (`series`: one series' slug).
    videosOfAccount: (userId, query) => require('./video.service').videosOfAccount(userId, query),
    // a topic's published videos, as video cards, newest first.
    videosOfTopic: (topicId) => require('./video.service').videosOfTopic(topicId),
    // Nov 24: these videos as cards with their status (drafts too), newest first (a topic's videos, for admins).
    videoCards: (ids) => require('./video.service').videoCards(ids),
    // Nov 24: what the topics' AI reads of the published videos: [{ id, slug, title, series, about }].
    aiCandidates: (options) => require('./video.service').aiCandidates(options),
    // the site-wide search's video group: { count, rows } with exact matches first.
    searchVideos: ({ q, limit, offset }) => require('./video.service').listVideos({ search: q, limit, page: offset / limit + 1 }, { rank: true }),
    // the sitemap's published videos: [{ id, slug, updated_at }].
    sitemapVideos: () => require('./video.service').sitemapVideos(),
};
