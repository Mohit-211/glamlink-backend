// Watch: videos by series (Beauty Vault Podcast, Expert Take, Treatment Spotlight, Industry Voices), stored on the
// server and imported from each series' YouTube playlist; the people in them and their topics.
const { configured } = require('../../integrations/youtube');
const logger = require('../../core/logger');

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/videos', router: require('./video.route') },
        { path: '/video-series', router: require('./videoSeries.route') },
    ],
    // Hourly at :17, with YOUTUBE_API_KEY set: each series' playlist, its new uploads imported.
    jobs: () => (configured()
        ? [{
            name: 'videos-youtube-sync',
            schedule: '17 * * * *',
            run: async () => {
                try {
                    const { imported } = await require('./videoAdmin.service').syncSeries();
                    if (imported) logger.info(`YouTube: ${imported} new videos imported`);
                } catch (err) {
                    logger.error('YouTube import failed', err);
                }
            },
        }]
        : []),
    // For other modules (loaded when called, so this file stays light):
    // the published videos an account appears in, as { count, rows } of video cards.
    videosOfAccount: (userId, query) => require('./video.service').videosOfAccount(userId, query),
    // a topic's published videos, as video cards.
    videosOfTopic: (topicId) => require('./video.service').videosOfTopic(topicId),
    // the site-wide search's video group: { count, rows } with exact matches first.
    searchVideos: ({ q, limit, offset }) => require('./video.service').listVideos({ search: q, limit, page: offset / limit + 1 }, { rank: true }),
    // the sitemap's published videos: [{ id, slug, updated_at }].
    sitemapVideos: () => require('./video.service').sitemapVideos(),
};
