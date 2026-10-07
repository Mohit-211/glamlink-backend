/** @format */

const Country = require("./country.model");
const State = require("./state.model");
const City = require("./city.model");
const Timezone = require("./timezone.model");
const Category = require("./category.model");
const Price = require("./price.model");
const Profession = require("./profession.model");
const Tag = require("./tag.model");

const Role = require("./role.model");
const Department = require("./departmenat.model");

const Admin = require("./admin.model");
const User = require("./user.model");
const Profile = require("./profile.model");
const UserToken = require("./userToken.model");
const UserAttachment = require("./userAttachment.model");
const userLoginTiming = require("./user_login_timings.model");
const UserFees = require("./userFees.model");

const ContactUs = require("./contactUs.model");
const Faq = require("./faq.model");
const OTP = require("./otp.model");

const Language = require("./language.model");
const Review = require("./review.model");
const ReviewLike = require("./reviewLike.model");
const ReviewComment = require("./reviewComment.model");

const Case = require("./case.model");
const CaseAttachment = require("./caseAttachment.model");
const Slot = require("./slot.model");
const Payment = require("./payment.model");
const Appointment = require("./appointment.model");

const ScheduleRule = require("./scheduleRule.model");
const RuleInterval = require("./ruleInterval.model");
const Availability = require("./availability.model");
const Notification = require("./notification.model");
const FeesChangeRequest = require("./feesChangeRequest.model");
const Booking = require("./booking.model");
const BookingSlot = require("./bookingSlots.model");

const Feed = require("./feed.model");
const Post = require("./post.model");
const Feed_Post = require("./feed_post.model");
const PostAttachment = require("./postAttachment.model");
const PostFavorite = require("./postFavorite.model");
const PostLike = require("./postLike.model");
const PostComment = require("./postComment.model");
const Post_Tag = require("./post_tag.model");

const Follow = require("./follower.model");

const Reel = require("./reel.model");
const Reel_Tag = require("./reel_tag.model");

const ServiceList = require("./serviceList.model");
const Service = require("./service.model");
const ServiceAttachment = require("./serviceAttachment.model");

const Permission = require("./permission.model");
const PermissionUser = require("./userPermission.model");

const SubscriptionPlan = require("./subscription_plan.model");
const UserSubscription = require("./user_subscription.model");

const Album = require("./album.model");
const AlbumComment = require("./albumComment.model");
const AlbumLike = require("./albumLike.model");
const AlbumAttachment = require("./albumAttachment.model");
const AlbumAttachmentComment = require("./albumAttachmentComment.model");
const AlbumAttachmentLike = require("./albumAttachmentLike.model");

const BlogCategory = require("./blogCategory.model");
const Blog = require("./blog.model");
const BlogCategoryMapping = require("./blogCategoryMapping.model");
const BlogAttachment = require("./blogAttachment.model");
const Keyword = require("./keyword.model");
const ReelComment = require("./reelComment.model");
const ReelLike = require("./reelLike.model");
const PostReport = require("./postReport.model");
const UserBlock = require("./userBlock.model");
const UserReport = require("./userReport.model");
const Story = require("./story.model");
const Wall = require("./wall.model");
const Wall_Story = require("./wall_story.model");

// E-commerce models here

const ProductCategoryHeading = require("./productCategoryHeading.model");
const ProductCategory = require("./productCategory.model");
const ProductCategoryMapping = require("./productCategoryMapping.model");
const Product = require("./product.model");
const ProductAttachment = require("./productAttachment.model");
const ProductReview = require("./productReview.model");
const Wishlist = require("./wishlist.model");
const Cart = require("./cart.model");
const Order = require("./order.model");
const OrderDetails = require("./orderDetails.model");
const OrderParcelDetails = require("./orderParcelDetails.model");
const UserAddress = require("./userAddress.model");
const ServiceLocation = require("./serviceLocation.model");
const Customer = require("./customer.model");
const Vendor = require("./vendor.model");
const Brand = require("./brand.model");
const ProductType = require("./productType.model");
const ProductTypeMapping = require("./productTypeMapping.model");
const CRMPayment = require("./crmPayment.model");
const ProfessionalFormQuestion = require("./professionalFormQuestion.model");
const ProfessionalFormAnswer = require("./professionalFormAnswer.model");
const NumeralTaxCategory = require("./numeralTaxCtaegory.model");
const ProfessionalPayout = require("./professionalPayout.model");
const BannerMedia = require("./bannerMedia.model");
const UserPromotion = require("./userPromotion.model");
const PromotionPayment = require("./promotionPayment.model");

const BrandAssociation = require("./brandAssociation.model");

const GlamCoinRule = require("./rewardRule.model");
const UserGlamCoinEvent = require("./userGlamcoinEvent.model");

const FaceAnalysis = require("./faceAnalysis.model");
const FaceAnalysisQnA = require("./faceAnalysisQnA.model");

const Guest = require("./guest.model");

const BusinessCard = require("./businessCard.model");
const BusinessCardCategory = require("./businessCardCategory.model");
const BusinessLocation = require("./businessLocation.model");
const BusinessHour = require("./businessHour.model");
const BusinessGalleryMedia = require("./businessGalleryMedia.model");

const JournalCategory = require("./journalCategory.model");
const Journal = require("./journal.model");
const Eduction = require("./education.model");
const Shop = require("./shop.model");
const Event = require("./event.model");
const Author = require("./authors.model");
const Directory = require("./directories.model");
const DirectoryCategories = require("./directoryCategory.model");

const GuestApplication = require("./guestApplication.model");
const PodcastSchedule = require("./podcastSchedule.model");
const JournalDownload = require("./journalDownload.model");
const JournalShop = require("./journalShop.model");
const AccessOrder = require("./accessOrder.model");
const AccessCardAnalytics = require("./AccessCardAnalytics.model");

const Ad = require("./Ad.model");
const JournalFaqMapping = require("./JournalFaqMapping");
const JournalTopicMapping = require("./JournalTopicMapping");
const JournalFaq = require("./JournalFaq");
const JournalTopic = require("./JournalTopic");
const JournalTopicPodcastMapping = require("./JournalTopicPodcastMapping");
const JournalTopicProductMapping = require("./JournalTopicProductMapping");
const JournalTopicProfessionalMapping = require("./JournalTopicProfessionalMapping");
const JournalTopicParagraphMapping = require("./JournalTopicParagraphMapping");
const PartnershipInquiry = require("./PartnershipInquiry.model");

module.exports = {
  Country,
  State,
  City,
  Timezone,
  Category,
  Price,
  Profession,

  Role,
  Department,

  Admin,
  User,
  UserBlock,
  UserReport,
  Profile,
  UserToken,
  UserAttachment,
  userLoginTiming,
  UserFees,

  ContactUs,
  Faq,
  OTP,

  Language,
  Review,
  ReviewLike,
  ReviewComment,

  Case,
  CaseAttachment,
  Slot,
  Appointment,
  Payment,
  ScheduleRule,
  RuleInterval,
  Availability,
  Notification,
  FeesChangeRequest,
  Booking,
  BookingSlot,

  Feed,
  Post,
  Feed_Post,
  PostAttachment,
  PostFavorite,
  PostLike,
  PostComment,
  PostReport,

  Follow,

  Reel,
  ReelLike,
  ReelComment,
  Album,
  AlbumComment,
  AlbumLike,
  AlbumAttachment,
  AlbumAttachmentComment,
  AlbumAttachmentLike,
  Reel_Tag,

  ServiceList,
  Service,
  ServiceAttachment,

  Permission,
  PermissionUser,

  SubscriptionPlan,
  UserSubscription,

  BlogCategory,
  Blog,
  BlogAttachment,
  BlogCategoryMapping,

  Keyword,

  Story,
  Wall,
  Wall_Story,
  Tag,
  Post_Tag,

  ProductCategory,
  ProductCategoryHeading,
  ProductCategoryMapping,
  Product,
  ProductAttachment,
  ProductReview,
  Wishlist,
  Cart,
  Order,
  OrderDetails,
  OrderParcelDetails,
  UserAddress,
  ServiceLocation,
  Customer,
  Vendor,
  Brand,
  ProductType,
  ProductTypeMapping,
  CRMPayment,
  ProfessionalFormAnswer,
  ProfessionalFormQuestion,
  NumeralTaxCategory,
  ProfessionalPayout,
  BannerMedia,
  UserPromotion,
  PromotionPayment,

  BrandAssociation,

  GlamCoinRule,
  UserGlamCoinEvent,

  FaceAnalysis,
  FaceAnalysisQnA,

  Guest,
  BusinessCard,
  BusinessCardCategory,
  BusinessLocation,
  BusinessHour,
  BusinessGalleryMedia,
  AccessOrder,
  AccessCardAnalytics,

  JournalCategory,
  JournalDownload,
  JournalShop,
  Journal,
  JournalFaq,
  JournalTopic,
  JournalFaqMapping,
  JournalTopicMapping,
  JournalTopicPodcastMapping,
  JournalTopicProductMapping,
  JournalTopicProfessionalMapping,
  JournalTopicParagraphMapping,
  Eduction,
  Shop,
  Event,
  Author,
  Directory,
  DirectoryCategories,
  GuestApplication,

  PodcastSchedule,
  Ad,
  PartnershipInquiry
};

async function initTableRelation() {
  // Country
  Country.hasMany(State, { foreignKey: "country_id", as: "all_state" });
  State.belongsTo(Country, { foreignKey: "country_id", as: "country" });

  Country.hasMany(City, { foreignKey: "country_id", as: "all_city" });
  City.belongsTo(Country, { foreignKey: "country_id", as: "country" });

  // State
  State.hasMany(City, { foreignKey: "state_id", as: "all_city" });
  City.belongsTo(State, { foreignKey: "state_id", as: "state" });

  // Department
  Department.hasMany(Admin, {
    foreignKey: "department_id",
    as: "department_admins",
  });
  Admin.belongsTo(Department, {
    foreignKey: "department_id",
    as: "admin_department",
  });

  // User
  Role.hasMany(Admin, { foreignKey: "role_id", as: "role_admins" });
  Admin.belongsTo(Role, { foreignKey: "role_id", as: "admin_role" });

  Role.hasMany(User, { foreignKey: "role_id", as: "role_users" });
  User.belongsTo(Role, { foreignKey: "role_id", as: "user_role" });

  User.hasOne(Profile, { foreignKey: "user_id", as: "user_profile" });
  Profile.belongsTo(User, { foreignKey: "user_id", as: "profile_user" });

  User.hasMany(UserAttachment, {
    foreignKey: "user_id",
    as: "user_attachments",
  });
  UserAttachment.belongsTo(User, {
    foreignKey: "user_id",
    as: "attachments_user",
  });

  User.hasMany(UserAttachment, {
    foreignKey: "user_id",
    as: "user_album_attachments",
  });
  UserAttachment.belongsTo(User, {
    foreignKey: "user_id",
    as: "attachments_album_user",
  });

  User.hasMany(Album, { foreignKey: "user_id", as: "user_albums" });
  Album.belongsTo(User, { foreignKey: "user_id", as: "album_user" });

  Album.hasMany(AlbumLike, { foreignKey: "album_id", as: "album_likes" });
  AlbumAttachment.hasMany(AlbumAttachmentLike, {
    foreignKey: "album_attachment_id",
    as: "album_attachment_likes",
  });

  User.hasMany(UserToken, { foreignKey: "user_id", as: "user_tokens" });
  UserToken.belongsTo(User, { foreignKey: "user_id", as: "token_user" });

  UserToken.belongsTo(Profile, {
    foreignKey: "user_id",
    as: "token_user_profile",
    sourceKey: "user_id",
  });

  userLoginTiming.belongsTo(User, { foreignKey: "user_id", as: "login_user" });
  userLoginTiming.belongsTo(Timezone, {
    foreignKey: "time_zone",
    as: "login_user_timezone",
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

  User.belongsToMany(Price, { through: UserFees, foreignKey: "user_id" });
  Price.belongsToMany(User, { through: UserFees, foreignKey: "price_id" });

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

  //User City || User Country
  Profile.belongsTo(State, { foreignKey: "state_id", as: "user_state" });
  Profile.belongsTo(City, { foreignKey: "city_id", as: "user_city" });

  // Review Rating

  User.hasMany(Review, { foreignKey: "user_id", as: "user_reviews" });
  Review.belongsTo(User, { foreignKey: "user_id", as: "reviewed_by" });
  Review.belongsTo(User, { foreignKey: "counselor_id", as: "reviewed_to" });

  User.hasMany(Review, { foreignKey: "counselor_id", as: "counselor_reviews" });
  Review.belongsTo(User, { foreignKey: "counselor_id", as: "reviewed_for" });

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

  // Cases
  User.hasMany(Case, { foreignKey: "user_id", as: "user_cases" });
  Case.belongsTo(User, { foreignKey: "user_id", as: "filled_by" });

  User.hasMany(Case, { foreignKey: "counselor_id", as: "counselor_cases" });
  Case.belongsTo(User, { foreignKey: "counselor_id", as: "filled_to" });

  Case.hasMany(CaseAttachment, {
    foreignKey: "case_id",
    as: "case_attachments",
  });
  CaseAttachment.belongsTo(Case, {
    foreignKey: "case_id",
    as: "attachment_case",
  });

  Case.hasMany(Appointment, { foreignKey: "case_id", as: "case_appointments" });
  Appointment.belongsTo(Case, {
    foreignKey: "case_id",
    as: "appointment_case",
  });

  // Scheduling

  User.hasMany(Slot, { foreignKey: "counselor_id", as: "counselor_slots" });
  Slot.belongsTo(User, { foreignKey: "counselor_id", as: "slot_counselor" });

  RuleInterval.hasMany(Slot, {
    foreignKey: "interval_id",
    as: "interval_slots",
  });
  Slot.belongsTo(RuleInterval, {
    foreignKey: "interval_id",
    as: "slot_interval",
  });

  // Appointment
  // User.hasMany(Appointment, { foreignKey: 'user_id', as: 'user_appointments' });
  // Appointment.belongsTo(User, { foreignKey: 'user_id', as: 'appointment_user' });

  // User.hasMany(Appointment, { foreignKey: 'counselor_id', as: 'counselor_appointments' });
  // Appointment.belongsTo(User, { foreignKey: 'counselor_id', as: 'appointment_counselor' });

  // Slot.hasMany(Appointment, { foreignKey: 'slot_id', as: 'slot_appointments' });
  // Appointment.belongsTo(Slot, { foreignKey: 'slot_id', as: 'appointment_slot' });

  // Appointment.hasOne(Payment, { foreignKey: 'appointment_id', as: 'appointment_payment' });
  // Payment.belongsTo(Appointment, { foreignKey: 'appointment_id', as: 'payment_appointment' });

  // ScheduleRule.hasMany(RuleInterval, { foreignKey: 'rule_id', as: 'rule_intervals' });
  // RuleInterval.belongsTo(ScheduleRule, { foreignKey: 'rule_id', as: 'interval_rule' });

  // Booking
  User.hasMany(Booking, { foreignKey: "user_id", as: "user_appointments" });
  Booking.belongsTo(User, { foreignKey: "user_id", as: "appointment_user" });

  Customer.hasMany(Booking, {
    foreignKey: "user_id",
    as: "customer_appointments",
  });
  Booking.belongsTo(Customer, {
    foreignKey: "user_id",
    as: "appointment_customer",
  });

  User.hasMany(Booking, {
    foreignKey: "counselor_id",
    as: "counselor_appointments",
  });
  Booking.belongsTo(User, {
    foreignKey: "counselor_id",
    as: "appointment_counselor",
  });

  BookingSlot.hasMany(Booking, {
    foreignKey: "slot_id",
    as: "slot_appointments",
  });
  Booking.belongsTo(BookingSlot, {
    foreignKey: "slot_id",
    as: "appointment_slot",
  });

  //FeesChangeRequest
  User.hasMany(FeesChangeRequest, {
    foreignKey: "user_id",
    as: "user_fees_change_requests",
  });
  FeesChangeRequest.belongsTo(User, {
    foreignKey: "user_id",
    as: "fees_change_request_user",
  });

  User.hasMany(Payment, { foreignKey: "user_id", as: "user_payments" });
  Payment.belongsTo(User, { foreignKey: "user_id", as: "payment_user" });

  BusinessCard.hasMany(Payment, {
    foreignKey: "business_card_id",
    as: "business_card_payments",
  });

  Payment.belongsTo(BusinessCard, {
    foreignKey: "business_card_id",
    as: "business_card",
  });

  //Follow
  User.hasMany(Follow, { foreignKey: "follower_id", as: "all_follower" });
  User.hasMany(Follow, { foreignKey: "followee_id", as: "all_followee" });

  Follow.belongsTo(User, { foreignKey: "follower_id", as: "follow_user" });
  Follow.belongsTo(User, { foreignKey: "followee_id", as: "followee_user" });

  // Post feed according to follower
  Post.belongsToMany(Feed, { through: Feed_Post, foreignKey: "post_id" });
  Feed.belongsToMany(Post, { through: Feed_Post, foreignKey: "feed_id" });

  Post.hasMany(PostFavorite, { foreignKey: "post_id", as: "favourite_posts" });

  User.hasMany(Post, { foreignKey: "user_id", as: "posts" });
  Post.belongsTo(User, { foreignKey: "user_id", as: "created_by" });

  User.hasOne(Feed, { foreignKey: "user_id", as: "feed" });
  Feed.belongsTo(User, { foreignKey: "user_id", as: "feed_user" });

  Post_Tag.belongsTo(Tag, { foreignKey: "tag_id", as: "tag" });
  Post.belongsToMany(Tag, { through: Post_Tag, foreignKey: "post_id" });
  Tag.belongsToMany(Post, { through: Post_Tag, foreignKey: "tag_id" });

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

  //Service
  Category.hasMany(ServiceList, {
    foreignKey: "category_id",
    as: "category_service_lists",
  });
  ServiceList.belongsTo(Category, {
    foreignKey: "category_id",
    as: "service-list-category",
  });

  Category.hasMany(Service, { foreignKey: "category_id", as: "all_services" });
  Service.belongsTo(Category, { foreignKey: "category_id", as: "category" });

  User.hasMany(Service, { foreignKey: "user_id", as: "all_service" });
  Service.belongsTo(User, { foreignKey: "user_id", as: "created_by" });

  Service.hasMany(ServiceAttachment, {
    foreignKey: "service_id",
    as: "attachements",
  });
  ServiceAttachment.belongsTo(Service, {
    foreignKey: "service_id",
    as: "attachment_service",
  });

  // Service.hasMany(Appointment, { foreignKey: 'service_id', as: 'service_appointments' });
  // Appointment.belongsTo(Service, { foreignKey: 'service_id', as: 'appointment_service' });

  Service.hasMany(Booking, {
    foreignKey: "service_id",
    as: "service_appointments",
  });
  Booking.belongsTo(Service, {
    foreignKey: "service_id",
    as: "appointment_service",
  });

  // ACl Permission
  Permission.hasMany(PermissionUser, {
    foreignKey: "permission_id",
    as: "permission_permission_user",
  });
  PermissionUser.belongsTo(Permission, {
    foreignKey: "permission_id",
    as: "permission_user_permission",
  });

  Permission.hasMany(Permission, { foreignKey: "parent_id", as: "children" });

  //Subscription
  User.hasOne(UserSubscription, {
    foreignKey: "user_id",
    as: "user_subscription",
  });
  UserSubscription.belongsTo(User, {
    foreignKey: "user_id",
    as: "subscription_user",
  });
  UserSubscription.belongsTo(SubscriptionPlan, {
    foreignKey: "subscription_plan_id",
    as: "user_subscription_plan",
  });

  //Blog

  // BlogCategory.hasMany(Blog, { foreignKey: 'blog_category_id', as: 'all_blogs' });
  // Blog.belongsTo(BlogCategory, { foreignKey: 'blog_category_id', as: 'blog_category' });

  Blog.belongsToMany(BlogCategory, {
    through: "BlogCategoryMapping",
    foreignKey: "blog_id",
    as: "blog_categories",
  });

  BlogCategory.belongsToMany(Blog, {
    through: "BlogCategoryMapping",
    foreignKey: "blog_category_id",
    as: "blogs",
  });

  Blog.hasMany(BlogAttachment, {
    foreignKey: "blog_id",
    as: "blog_attachments",
  });
  BlogAttachment.belongsTo(Blog, {
    foreignKey: "blog_id",
    as: "attachment_blog",
  });

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

  Story.belongsToMany(Wall, { through: Wall_Story, foreignKey: "story_id" });
  Wall.belongsToMany(Story, { through: Wall_Story, foreignKey: "wall_id" });

  // Reels

  User.hasMany(Reel, { foreignKey: "user_id", as: "user_reels" });
  Reel.belongsTo(User, { foreignKey: "user_id", as: "reel_user" });

  Reel_Tag.belongsTo(Tag, { foreignKey: "tag_id", as: "tag" });
  // Reel.belongsToMany(Tag, { through: Reel_Tag, foreignKey: "reel_id" });
  // Tag.belongsToMany(Post, { through: Reel_Tag, foreignKey: "tag_id" });

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

  Notification.belongsTo(User, { foreignKey: "sender_id", as: "sender" });
  Notification.belongsTo(User, { foreignKey: "receiver_id", as: "receiver" });

  User.hasMany(Availability, {
    foreignKey: "counselor_id",
    as: "availablity_Availability",
  });
  Availability.belongsTo(User, {
    foreignKey: "counselor_id",
    as: "user_availablity",
  });

  // e-commerce joins
  Product.belongsToMany(ProductCategory, {
    through: "ProductCategoryMapping",
    foreignKey: "product_id",
    as: "product_categories",
  });

  ProductCategory.belongsToMany(Product, {
    through: "ProductCategoryMapping",
    foreignKey: "product_category_id",
    as: "products",
  });

  ProductCategoryHeading.hasMany(ProductCategory, {
    foreignKey: "category_id",
    as: "product_categories_heading",
  });

  ProductCategory.belongsTo(ProductCategoryHeading, {
    foreignKey: "category_id",
    as: "products_heading",
  });

  Product.belongsToMany(ProductType, {
    through: "ProductTypeMapping",
    foreignKey: "product_id",
    as: "product_type",
  });

  ProductType.belongsToMany(Product, {
    through: "ProductTypeMapping",
    foreignKey: "product_type_id",
    as: "type_products",
  });

  Product.hasMany(ProductAttachment, {
    foreignKey: "product_id",
    as: "product_attachments",
  });
  ProductAttachment.belongsTo(Product, {
    foreignKey: "product_id",
    as: "attachment_product",
  });

  Vendor.hasMany(Product, {
    foreignKey: "vendor_id",
    as: "product_vendor",
  });
  Product.belongsTo(Vendor, {
    foreignKey: "vendor_id",
    as: "vendor_product",
  });

  Brand.hasMany(Product, {
    foreignKey: "brand_id",
    as: "product_brand",
  });
  Product.belongsTo(Brand, {
    foreignKey: "brand_id",
    as: "brand_product",
  });

  User.hasMany(Product, {
    foreignKey: "user_id",
    as: "product_user",
  });
  Product.belongsTo(User, {
    foreignKey: "user_id",
    as: "user_product",
  });

  User.hasMany(ProductReview, {
    foreignKey: "user_id",
    as: "product_review",
  });
  ProductReview.belongsTo(User, {
    foreignKey: "user_id",
    as: "review_product",
  });

  Product.hasMany(ProductReview, {
    foreignKey: "product_id",
    as: "product_reviews",
  });
  ProductReview.belongsTo(Product, {
    foreignKey: "product_id",
    as: "reviews_product",
  });

  Product.hasMany(Wishlist, {
    foreignKey: "product_id",
    as: "product_wishlist",
  });
  Wishlist.belongsTo(Product, {
    foreignKey: "product_id",
    as: "wishlist_product",
  });

  Product.hasMany(Cart, {
    foreignKey: "product_id",
    as: "product_cart",
  });
  Cart.belongsTo(Product, {
    foreignKey: "product_id",
    as: "cart_product",
  });

  Product.hasMany(OrderDetails, {
    foreignKey: "product_id",
    as: "product_orderDetails",
  });
  OrderDetails.belongsTo(Product, {
    foreignKey: "product_id",
    as: "product_details",
  });

  Order.hasMany(OrderDetails, {
    foreignKey: "order_id",
    as: "details_order",
  });

  OrderDetails.belongsTo(Order, {
    foreignKey: "order_id",
    as: "order_details_order",
  });

  OrderDetails.hasOne(OrderParcelDetails, {
    foreignKey: "order_id",
    as: "order_details_parcel",
  });

  OrderParcelDetails.belongsTo(OrderDetails, {
    foreignKey: "order_id",
    as: "parcel_details_order",
  });

  Order.hasMany(Payment, {
    foreignKey: "order_id",
    as: "order_payment",
  });
  Payment.belongsTo(Order, {
    foreignKey: "order_id",
    as: "payment_order",
  });

  Order.belongsTo(UserAddress, {
    foreignKey: "address_id",
    targetKey: "id",
    as: "order_address",
  });

  UserAddress.hasMany(Order, {
    foreignKey: "address_id",
    targetKey: "id",
    as: "address_order",
  });
  User.hasOne(UserAddress, {
    foreignKey: "user_id",
    as: "user_address",
  });

  User.hasMany(Order, {
    foreignKey: "user_id",
    as: "user_order",
  });
  Order.belongsTo(User, {
    foreignKey: "user_id",
    as: "orders_user",
  });

  UserAddress.belongsTo(Country, {
    foreignKey: "country_id",
    as: "user_country",
  });
  Country.hasMany(UserAddress, {
    foreignKey: "country_id",
    as: "country_user",
  });

  UserAddress.belongsTo(State, { foreignKey: "state_id", as: "user_state" });
  State.hasMany(UserAddress, { foreignKey: "state_id", as: "state_user" });

  UserAddress.belongsTo(City, { foreignKey: "city_id", as: "user_city" });
  City.hasMany(UserAddress, { foreignKey: "city_id", as: "city_user" });

  ServiceLocation.belongsTo(Country, {
    foreignKey: "country_id",
    as: "service_country",
  });
  Country.hasMany(ServiceLocation, {
    foreignKey: "country_id",
    as: "country_service",
  });

  ServiceLocation.belongsTo(State, {
    foreignKey: "state_id",
    as: "service_state",
  });
  State.hasMany(ServiceLocation, {
    foreignKey: "state_id",
    as: "state_service",
  });

  ServiceLocation.belongsTo(City, {
    foreignKey: "city_id",
    as: "service_city",
  });
  City.hasMany(ServiceLocation, { foreignKey: "city_id", as: "city_service" });

  User.hasMany(Customer, {
    foreignKey: "user_id",
    as: "user_customer",
  });
  Customer.belongsTo(User, {
    foreignKey: "user_id",
    as: "customer_user",
  });

  User.hasMany(ProfessionalFormAnswer, {
    foreignKey: "user_id",
    as: "user_answers",
  });
  ProfessionalFormAnswer.belongsTo(User, {
    foreignKey: "user_id",
    as: "answers_user",
  });

  ProfessionalFormQuestion.hasMany(ProfessionalFormAnswer, {
    foreignKey: "question_id",
    as: "form_questions",
  });
  ProfessionalFormAnswer.belongsTo(ProfessionalFormQuestion, {
    foreignKey: "question_id",
    as: "questions_form",
  });

  User.hasMany(BannerMedia, {
    foreignKey: "user_id",
    as: "user_banner",
  });
  BannerMedia.belongsTo(User, {
    foreignKey: "user_id",
    as: "banner_user",
  });

  User.hasMany(Service, {
    foreignKey: "user_id",
    as: "user_service",
  });
  Service.belongsTo(User, {
    foreignKey: "user_id",
    as: "service_user",
  });

  User.hasMany(UserPromotion, {
    foreignKey: "user_id",
    as: "all_promotions",
  });

  User.hasMany(BrandAssociation, {
    foreignKey: "user_id",
    as: "beautician_brand_associations",
  });
  User.hasMany(BrandAssociation, {
    foreignKey: "brand_id",
    as: "brand_beautician_associations",
  });
  BrandAssociation.belongsTo(User, {
    foreignKey: "user_id",
    as: "brand_association_beautician",
  });
  BrandAssociation.belongsTo(User, {
    foreignKey: "brand_id",
    as: "brand_association_brand",
  });

  User.belongsTo(User, {
    as: "referrer", // alias for the beautician who referred
    foreignKey: "referred_by",
  });

  User.hasMany(User, {
    as: "referrals", // alias for users they referred
    foreignKey: "referred_by",
  });

  BusinessCard.belongsTo(User, {
    foreignKey: "user_id",
    as: "business_user",
  });
  User.hasMany(BusinessCard, {
    foreignKey: "user_id",
    as: "user_business_cards",
  });

  // BusinessCard → Locations
  BusinessCard.hasMany(BusinessLocation, {
    foreignKey: "business_card_id",
    as: "locations",
  });
  BusinessLocation.belongsTo(BusinessCard, {
    foreignKey: "business_card_id",
  });

  // BusinessCard → Gallery
  BusinessCard.hasMany(BusinessGalleryMedia, {
    foreignKey: "business_card_id",
    as: "images",
  });
  BusinessGalleryMedia.belongsTo(BusinessCard, {
    foreignKey: "business_card_id",
  });

  // BusinessCard → Business Hours
  BusinessCard.hasMany(BusinessHour, {
    foreignKey: "business_card_id",
    as: "business_hour",
  });
  BusinessHour.belongsTo(BusinessCard, {
    foreignKey: "business_card_id",
  });

  Directory.hasMany(DirectoryCategories, {
    foreignKey: "directory_id",
    as: "directory_categories",
  });
  DirectoryCategories.belongsTo(Directory, {
    foreignKey: "directory_id",
  });

  DirectoryCategories.belongsTo(BusinessCardCategory, {
    foreignKey: "category_id",
    as: "category",
  });

  // journal

  JournalCategory.hasMany(Journal, {
    foreignKey: "category_id",
    as: "journals",
  });

  Journal.belongsTo(JournalCategory, {
    foreignKey: "category_id",
    as: "journal_category",
  });

  Author.hasMany(Journal, {
    foreignKey: "author_id",
    as: "journals",
  });

  Journal.belongsTo(Author, {
    foreignKey: "author_id",
    as: "journal_author",
  });

  Journal.hasMany(JournalDownload, {
    foreignKey: "journal_id",
    as: "downloads",
  });

  JournalDownload.belongsTo(Journal, {
    foreignKey: "journal_id",
    as: "journal",
  });

  Journal.belongsToMany(Shop, {
    through: JournalShop,
    foreignKey: "journal_id",
    otherKey: "shop_id",
    as: "shops",
  });

  Shop.belongsToMany(Journal, {
    through: JournalShop,
    foreignKey: "shop_id",
    otherKey: "journal_id",
    as: "journals",
  });

  BusinessCard.hasMany(AccessOrder, {
    foreignKey: "business_card_id",
    as: "access_orders",
  });

  AccessOrder.belongsTo(BusinessCard, {
    foreignKey: "business_card_id",
    as: "business_card",
  });

  BusinessCard.hasMany(AccessCardAnalytics, {
    foreignKey: "business_card_id",
    as: "analytics",
    onDelete: "CASCADE",
  });

  AccessCardAnalytics.belongsTo(BusinessCard, {
    foreignKey: "business_card_id",
    as: "business_card",
  });

  Payment.hasOne(AccessOrder, {
    foreignKey: "payment_id",
    as: "access_order",
  });

  AccessOrder.belongsTo(Payment, {
    foreignKey: "payment_id",
    as: "payment",
  });

  User.hasMany(AccessOrder, {
    foreignKey: "user_id",
    as: "access_orders",
  });

  AccessOrder.belongsTo(User, {
    foreignKey: "user_id",
    as: "user",
  });

  // =========================================================
  // JOURNAL FAQ
  // =========================================================

  Journal.hasMany(JournalFaqMapping, {
    foreignKey: "journal_id",
    as: "faq_mappings",
  });

  JournalFaqMapping.belongsTo(Journal, {
    foreignKey: "journal_id",
    as: "journal",
  });

  JournalFaq.hasMany(JournalFaqMapping, {
    foreignKey: "faq_id",
    as: "journal_mappings",
  });

  JournalFaqMapping.belongsTo(JournalFaq, {
    foreignKey: "faq_id",
    as: "faq",
  });

  Journal.belongsToMany(JournalFaq, {
    through: JournalFaqMapping,
    foreignKey: "journal_id",
    otherKey: "faq_id",
    as: "faqs",
  });

  JournalFaq.belongsToMany(Journal, {
    through: JournalFaqMapping,
    foreignKey: "faq_id",
    otherKey: "journal_id",
    as: "journals",
  });

  // =========================================================
  // JOURNAL TOPIC
  // =========================================================

  Journal.hasMany(JournalTopicMapping, {
    foreignKey: "journal_id",
    as: "topic_mappings",
  });

  JournalTopicMapping.belongsTo(Journal, {
    foreignKey: "journal_id",
    as: "journal",
  });

  JournalTopic.hasMany(JournalTopicMapping, {
    foreignKey: "topic_id",
    as: "journal_mappings",
  });

  JournalTopicMapping.belongsTo(JournalTopic, {
    foreignKey: "topic_id",
    as: "topic",
  });

  Journal.belongsToMany(JournalTopic, {
    through: JournalTopicMapping,
    foreignKey: "journal_id",
    otherKey: "topic_id",
    as: "topics",
  });

  JournalTopic.belongsToMany(Journal, {
    through: JournalTopicMapping,
    foreignKey: "topic_id",
    otherKey: "journal_id",
    as: "journals",
  });

  // =========================================================
  // JOURNAL TOPIC → PARAGRAPHS
  // =========================================================

  JournalTopic.hasMany(JournalTopicParagraphMapping, {
    foreignKey: "topic_id",
    as: "paragraph_mappings",
  });

  JournalTopicParagraphMapping.belongsTo(JournalTopic, {
    foreignKey: "topic_id",
    as: "topic",
  });

  Journal.hasMany(JournalTopicParagraphMapping, {
    foreignKey: "journal_id",
    as: "topic_paragraph_mappings",
  });

  JournalTopicParagraphMapping.belongsTo(Journal, {
    foreignKey: "journal_id",
    as: "journal",
  });

  // =========================================================
  // TOPIC → PROFESSIONALS
  // =========================================================

  JournalTopic.hasMany(JournalTopicProfessionalMapping, {
    foreignKey: "topic_id",
    as: "professional_mappings",
  });

  JournalTopicProfessionalMapping.belongsTo(JournalTopic, {
    foreignKey: "topic_id",
    as: "topic",
  });

  User.hasMany(JournalTopicProfessionalMapping, {
    foreignKey: "user_id",
    as: "topic_professional_mappings",
  });

  JournalTopicProfessionalMapping.belongsTo(User, {
    foreignKey: "user_id",
    as: "professional",
  });

  JournalTopic.belongsToMany(User, {
    through: JournalTopicProfessionalMapping,
    foreignKey: "topic_id",
    otherKey: "user_id",
    as: "professionals",
  });

  User.belongsToMany(JournalTopic, {
    through: JournalTopicProfessionalMapping,
    foreignKey: "user_id",
    otherKey: "topic_id",
    as: "journal_topics",
  });

  // =========================================================
  // TOPIC → SHOPS
  // =========================================================

  JournalTopic.hasMany(JournalTopicProductMapping, {
    foreignKey: "topic_id",
    as: "product_mappings",
  });

  JournalTopicProductMapping.belongsTo(JournalTopic, {
    foreignKey: "topic_id",
    as: "topic",
  });

  Shop.hasMany(JournalTopicProductMapping, {
    foreignKey: "shop_id",
    as: "topic_product_mappings",
  });

  JournalTopicProductMapping.belongsTo(Shop, {
    foreignKey: "shop_id",
    as: "shop",
  });

  JournalTopic.belongsToMany(Shop, {
    through: JournalTopicProductMapping,
    foreignKey: "topic_id",
    otherKey: "shop_id",
    as: "shops",
  });

  Shop.belongsToMany(JournalTopic, {
    through: JournalTopicProductMapping,
    foreignKey: "shop_id",
    otherKey: "topic_id",
    as: "journal_topics",
  });

  // =========================================================
  // TOPIC → PODCASTS
  // =========================================================

  JournalTopic.hasMany(JournalTopicPodcastMapping, {
    foreignKey: "topic_id",
    as: "podcast_mappings",
  });

  JournalTopicPodcastMapping.belongsTo(JournalTopic, {
    foreignKey: "topic_id",
    as: "topic",
  });

  PodcastSchedule.hasMany(JournalTopicPodcastMapping, {
    foreignKey: "podcast_id",
    as: "topic_podcast_mappings",
  });

  JournalTopicPodcastMapping.belongsTo(PodcastSchedule, {
    foreignKey: "podcast_id",
    as: "podcast",
  });

  JournalTopic.belongsToMany(PodcastSchedule, {
    through: JournalTopicPodcastMapping,
    foreignKey: "topic_id",
    otherKey: "podcast_id",
    as: "podcasts",
  });

  PodcastSchedule.belongsToMany(JournalTopic, {
    through: JournalTopicPodcastMapping,
    foreignKey: "podcast_id",
    otherKey: "topic_id",
    as: "journal_topics",
  });
}

/* Only Uncomment when data migration will complete */
initTableRelation();
