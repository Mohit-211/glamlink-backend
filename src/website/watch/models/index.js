// The website/watch module's tables.
const VideoSeries = require('./videoSeries.model');
const Video = require('./video.model');
const VideoPerson = require('./videoPerson.model');
const JournalTopicVideoMapping = require('./journalTopicVideoMapping.model');

// The associations this module owns: the side that holds the foreign key.
const associate = () => {
    Video.belongsTo(VideoSeries, { foreignKey: 'series_id', as: 'series' });
    VideoSeries.hasMany(Video, { foreignKey: 'series_id', as: 'videos' });
    VideoPerson.belongsTo(Video, { foreignKey: 'video_id', as: 'video' });
    Video.hasMany(VideoPerson, { foreignKey: 'video_id', as: 'people' });
    JournalTopicVideoMapping.belongsTo(Video, { foreignKey: 'video_id', as: 'video' });
};

module.exports = { models: { VideoSeries, Video, VideoPerson, JournalTopicVideoMapping }, associate };
