// The mobile/social module's tables.
const Post = require('./post.model');
const PostAttachment = require('./postAttachment.model');
const PostComment = require('./postComment.model');
const PostLike = require('./postLike.model');
const PostFavorite = require('./postFavorite.model');
const PostReport = require('./postReport.model');
const PostTag = require('./postTag.model');
const Feed = require('./feed.model');
const FeedPost = require('./feedPost.model');
const Follow = require('./follow.model');
const Reel = require('./reel.model');
const ReelComment = require('./reelComment.model');
const ReelLike = require('./reelLike.model');
const ReelTag = require('./reelTag.model');
const Story = require('./story.model');
const Wall = require('./wall.model');
const WallStory = require('./wallStory.model');
const Album = require('./album.model');
const AlbumAttachment = require('./albumAttachment.model');
const AlbumComment = require('./albumComment.model');
const AlbumLike = require('./albumLike.model');
const AlbumAttachmentComment = require('./albumAttachmentComment.model');
const AlbumAttachmentLike = require('./albumAttachmentLike.model');
const Review = require('./review.model');
const ReviewComment = require('./reviewComment.model');
const ReviewLike = require('./reviewLike.model');
const UserBlock = require('./userBlock.model');
const UserReport = require('./userReport.model');
const Tag = require('./tag.model');

// The associations this module owns: the side that holds the foreign key. Called once every module's
// models are loaded (src/models.js), with all of them by name.
const associate = ({ User }) => {
  User.hasMany(Album, { foreignKey: "user_id", as: "user_albums" });

  Album.belongsTo(User, { foreignKey: "user_id", as: "album_user" });

  Album.hasMany(AlbumLike, { foreignKey: "album_id", as: "album_likes" });

  AlbumAttachment.hasMany(AlbumAttachmentLike, {
    foreignKey: "album_attachment_id",
    as: "album_attachment_likes",
  });


  // Album
  Album.hasMany(AlbumAttachment, {
    foreignKey: "album_id",
    as: "album_attachments",
  });

  AlbumAttachment.belongsTo(Album, {
    foreignKey: "album_id",
    as: "attachment_album",
  });

  Album.hasMany(AlbumComment, {
    foreignKey: "album_id",
    as: "album_comments",
  });

  AlbumComment.belongsTo(User, { foreignKey: "user_id", as: "commented_by" });

  AlbumLike.belongsTo(User, { foreignKey: "user_id", as: "liked_by" });

  AlbumAttachment.hasMany(AlbumAttachmentComment, {
    foreignKey: "album_attachment_id",
    as: "album_attachment_comments",
  });

  AlbumAttachmentComment.belongsTo(User, {
    foreignKey: "user_id",
    as: "commented_by",
  });

  AlbumAttachmentLike.belongsTo(User, {
    foreignKey: "user_id",
    as: "liked_by",
  });

  User.hasMany(UserBlock, {
    as: "blockedUsers",
    foreignKey: "blocked_by",
    sourceKey: "id",
  });

  User.hasMany(UserBlock, {
    as: "blockedByUsers",
    foreignKey: "blocked_to",
    sourceKey: "id",
  });


  // Review Rating
  User.hasMany(Review, { foreignKey: "user_id", as: "user_reviews" });

  Review.belongsTo(User, { foreignKey: "user_id", as: "reviewed_by" });

  Review.belongsTo(User, { foreignKey: "professional_id", as: "reviewed_to" });

  User.hasMany(Review, { foreignKey: "professional_id", as: "professional_reviews" });

  Review.belongsTo(User, { foreignKey: "professional_id", as: "reviewed_for" });

  Review.hasMany(ReviewLike, { foreignKey: "review_id", as: "like_reviews" });

  ReviewLike.belongsTo(Review, { foreignKey: "review_id", as: "review_like" });

  Review.hasMany(ReviewComment, {
    foreignKey: "review_id",
    as: "comment_review",
  });

  ReviewComment.belongsTo(Review, {
    foreignKey: "review_id",
    as: "review_comment",
  });


  //Follow
  User.hasMany(Follow, { foreignKey: "follower_id", as: "all_follower" });

  User.hasMany(Follow, { foreignKey: "followee_id", as: "all_followee" });

  Follow.belongsTo(User, { foreignKey: "follower_id", as: "follow_user" });

  Follow.belongsTo(User, { foreignKey: "followee_id", as: "followee_user" });


  // Post feed according to follower
  Post.belongsToMany(Feed, { through: FeedPost, foreignKey: "post_id" });

  Feed.belongsToMany(Post, { through: FeedPost, foreignKey: "feed_id" });

  Post.hasMany(PostFavorite, { foreignKey: "post_id", as: "favourite_posts" });

  User.hasMany(Post, { foreignKey: "user_id", as: "posts" });

  Post.belongsTo(User, { foreignKey: "user_id", as: "created_by" });

  User.hasOne(Feed, { foreignKey: "user_id", as: "feed" });

  Feed.belongsTo(User, { foreignKey: "user_id", as: "feed_user" });

  PostTag.belongsTo(Tag, { foreignKey: "tag_id", as: "tag" });

  Post.belongsToMany(Tag, { through: PostTag, foreignKey: "post_id" });

  Tag.belongsToMany(Post, { through: PostTag, foreignKey: "tag_id" });

  Post.hasMany(PostAttachment, { foreignKey: "post_id", as: "attachements" });

  PostAttachment.belongsTo(Post, {
    foreignKey: "post_id",
    as: "attachment_post",
  });

  User.hasMany(PostFavorite, { foreignKey: "user_id", as: "saved_posts" });

  PostFavorite.belongsTo(User, { foreignKey: "user_id", as: "saved_by" });

  User.hasMany(PostLike, { foreignKey: "user_id", as: "user_liked_posts" });

  PostLike.belongsTo(User, { foreignKey: "user_id", as: "liked_by" });

  PostLike.belongsTo(Post, {
    foreignKey: "post_id",
    as: "user_like_post_post",
  });

  Post.hasMany(PostComment, { foreignKey: "post_id", as: "comments" });

  PostComment.belongsTo(Post, { foreignKey: "post_id", as: "comment_post" });

  Post.hasMany(PostLike, { foreignKey: "post_id", as: "likes" });

  Post.hasMany(PostFavorite, { foreignKey: "post_id", as: "saves" });

  User.hasMany(PostComment, {
    foreignKey: "user_id",
    as: "user_commented_posts",
  });

  PostComment.belongsTo(User, { foreignKey: "user_id", as: "commented_by" });


  //Blocking
  User.hasMany(UserBlock, {
    foreignKey: "blocked_by",
    as: "blocked_by_user_details",
  });

  UserBlock.belongsTo(User, {
    foreignKey: "blocked_to",
    as: "blocked_user_details",
  });


  //Wall & story
  User.hasOne(Wall, { foreignKey: "user_id", as: "wall" });

  Wall.belongsTo(User, { foreignKey: "user_id", as: "wall_user" });

  User.hasMany(Story, { foreignKey: "user_id", as: "story" });

  Story.belongsTo(User, { foreignKey: "user_id", as: "created_by" });

  Story.belongsToMany(Wall, { through: WallStory, foreignKey: "story_id" });

  Wall.belongsToMany(Story, { through: WallStory, foreignKey: "wall_id" });


  // Reels
  User.hasMany(Reel, { foreignKey: "user_id", as: "user_reels" });

  Reel.belongsTo(User, { foreignKey: "user_id", as: "reel_user" });

  ReelTag.belongsTo(Tag, { foreignKey: "tag_id", as: "tag" });

  ReelLike.belongsTo(User, { foreignKey: "user_id", as: "reel_liked_by" });

  Reel.hasMany(ReelLike, { foreignKey: "reel_id", as: "reel_likes" });

  Reel.hasMany(ReelComment, { foreignKey: "reel_id", as: "reel_comments" });

  ReelLike.belongsTo(Reel, { foreignKey: "reel_id", as: "reel_like_reel" });

  ReelComment.belongsTo(Reel, {
    foreignKey: "reel_id",
    as: "reel_comment_reel",
  });

  ReelComment.belongsTo(User, {
    foreignKey: "user_id",
    as: "reel_commented_by",
  });
};

module.exports = { models: { Post, PostAttachment, PostComment, PostLike, PostFavorite, PostReport, PostTag, Feed, FeedPost, Follow, Reel, ReelComment, ReelLike, ReelTag, Story, Wall, WallStory, Album, AlbumAttachment, AlbumComment, AlbumLike, AlbumAttachmentComment, AlbumAttachmentLike, Review, ReviewComment, ReviewLike, UserBlock, UserReport, Tag }, associate };
