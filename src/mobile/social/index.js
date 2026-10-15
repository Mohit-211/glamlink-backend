// Posts, reels, stories, albums, reviews, chat, follows, feed and wall, search, blocks and reports.

module.exports = {
    // Mounted under /api/v1 by src/routes.js, in this order. Loaded on demand, so requiring this module for
    // the functions below never pulls in its routes.
    routes: () => [
        { path: '/user/', router: require('./social.route') },
        { path: '/post', router: require('./post.route') },
        { path: '/reel', router: require('./reel.route') },
        { path: '/story', router: require('./story.route') },
        { path: '/album', router: require('./album.route') },
        { path: '/review', router: require('./review.route') },
        { path: '/chat', router: require('./chat.route') },
    ],
};
