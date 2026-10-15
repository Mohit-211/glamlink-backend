/** @format */

const Country = require("./shared/reference/models/country.model");
const State = require("./shared/reference/models/state.model");
const City = require("./shared/reference/models/city.model");
const Timezone = require("./shared/reference/models/timezone.model");
const Category = require("./mobile/bookings/models/category.model");
const Profession = require("./shared/reference/models/profession.model");
const Tag = require("./mobile/social/models/tag.model");

const Role = require("./shared/admin/models/role.model");
const Department = require("./shared/admin/models/department.model");

const Admin = require("./shared/admin/models/admin.model");
const User = require("./shared/identity/models/user.model");
const Profile = require("./shared/users/models/profile.model");
const UserToken = require("./shared/identity/models/userToken.model");
const AuthSession = require("./shared/identity/models/authSession.model");
const EmailToken = require("./shared/identity/models/emailToken.model");
const UserIdentity = require("./shared/identity/models/userIdentity.model");
const UserAttachment = require("./shared/users/models/userAttachment.model");
const UserLoginTiming = require("./shared/identity/models/userLoginTiming.model");

const ContactUs = require("./website/inquiries/models/contactUs.model");
const Faq = require("./mobile/content/models/faq.model");
const OTP = require("./shared/identity/models/otp.model");

const Language = require("./shared/reference/models/language.model");
const Review = require("./mobile/social/models/review.model");
const ReviewLike = require("./mobile/social/models/reviewLike.model");
const ReviewComment = require("./mobile/social/models/reviewComment.model");

const Case = require("./mobile/bookings/models/case.model");
const CaseAttachment = require("./mobile/bookings/models/caseAttachment.model");
const Slot = require("./mobile/bookings/models/slot.model");
const Payment = require("./shared/billing/models/payment.model");
const Appointment = require("./mobile/bookings/models/appointment.model");

const Availability = require("./mobile/bookings/models/availability.model");
const Notification = require("./shared/notifications/models/notification.model");
const Booking = require("./mobile/bookings/models/booking.model");
const BookingSlot = require("./mobile/bookings/models/bookingSlot.model");

const Feed = require("./mobile/social/models/feed.model");
const Post = require("./mobile/social/models/post.model");
const FeedPost = require("./mobile/social/models/feedPost.model");
const PostAttachment = require("./mobile/social/models/postAttachment.model");
const PostFavorite = require("./mobile/social/models/postFavorite.model");
const PostLike = require("./mobile/social/models/postLike.model");
const PostComment = require("./mobile/social/models/postComment.model");
const PostTag = require("./mobile/social/models/postTag.model");

const Follow = require("./mobile/social/models/follow.model");

const Reel = require("./mobile/social/models/reel.model");
const ReelTag = require("./mobile/social/models/reelTag.model");

const ServiceList = require("./mobile/bookings/models/serviceList.model");
const Service = require("./mobile/bookings/models/service.model");
const ServiceAttachment = require("./mobile/bookings/models/serviceAttachment.model");

const Permission = require("./shared/admin/models/permission.model");
const PermissionUser = require("./shared/admin/models/permissionUser.model");


const Album = require("./mobile/social/models/album.model");
const AlbumComment = require("./mobile/social/models/albumComment.model");
const AlbumLike = require("./mobile/social/models/albumLike.model");
const AlbumAttachment = require("./mobile/social/models/albumAttachment.model");
const AlbumAttachmentComment = require("./mobile/social/models/albumAttachmentComment.model");
const AlbumAttachmentLike = require("./mobile/social/models/albumAttachmentLike.model");

const BlogCategory = require("./website/content/models/blogCategory.model");
const Blog = require("./website/content/models/blog.model");
const BlogCategoryMapping = require("./website/content/models/blogCategoryMapping.model");
const BlogAttachment = require("./website/content/models/blogAttachment.model");
const Keyword = require("./mobile/promotions/models/keyword.model");
const ReelComment = require("./mobile/social/models/reelComment.model");
const ReelLike = require("./mobile/social/models/reelLike.model");
const PostReport = require("./mobile/social/models/postReport.model");
const UserBlock = require("./mobile/social/models/userBlock.model");
const UserReport = require("./mobile/social/models/userReport.model");
const Story = require("./mobile/social/models/story.model");
const Wall = require("./mobile/social/models/wall.model");
const WallStory = require("./mobile/social/models/wallStory.model");

// E-commerce models here

const ProductCategoryHeading = require("./mobile/commerce/models/productCategoryHeading.model");
const ProductCategory = require("./mobile/commerce/models/productCategory.model");
const ProductCategoryMapping = require("./mobile/commerce/models/productCategoryMapping.model");
const Product = require("./mobile/commerce/models/product.model");
const ProductAttachment = require("./mobile/commerce/models/productAttachment.model");
const ProductReview = require("./mobile/commerce/models/productReview.model");
const Wishlist = require("./mobile/commerce/models/wishlist.model");
const Cart = require("./mobile/commerce/models/cart.model");
const Order = require("./mobile/commerce/models/order.model");
const OrderDetails = require("./mobile/commerce/models/orderDetails.model");
const OrderParcelDetails = require("./mobile/commerce/models/orderParcelDetails.model");
const UserAddress = require("./shared/users/models/userAddress.model");
const ServiceLocation = require("./mobile/bookings/models/serviceLocation.model");
const Customer = require("./crm/models/customer.model");
const Vendor = require("./crm/models/vendor.model");
const Brand = require("./mobile/commerce/models/brand.model");
const ProductType = require("./mobile/commerce/models/productType.model");
const ProductTypeMapping = require("./mobile/commerce/models/productTypeMapping.model");
const CRMPayment = require("./crm/models/crmPayment.model");
const ProfessionalFormQuestion = require("./website/professional-form/models/professionalFormQuestion.model");
const ProfessionalFormAnswer = require("./website/professional-form/models/professionalFormAnswer.model");
const NumeralTaxCategory = require("./mobile/commerce/models/numeralTaxCategory.model");
const ProfessionalPayout = require("./mobile/commerce/models/professionalPayout.model");
const BannerMedia = require("./mobile/content/models/bannerMedia.model");
const UserPromotion = require("./mobile/promotions/models/userPromotion.model");
const PromotionPayment = require("./mobile/promotions/models/promotionPayment.model");

const BrandAssociation = require("./mobile/commerce/models/brandAssociation.model");

const GlamCoinRule = require("./mobile/glamcoins/models/glamCoinRule.model");
const UserGlamCoinEvent = require("./mobile/glamcoins/models/userGlamcoinEvent.model");

const FaceAnalysis = require("./mobile/face-analysis/models/faceAnalysis.model");
const FaceAnalysisQnA = require("./mobile/face-analysis/models/faceAnalysisQnA.model");

const Guest = require("./mobile/guests/models/guest.model");

const BusinessCard = require("./website/access-card/models/businessCard.model");
const BusinessCardCategory = require("./website/access-card/models/businessCardCategory.model");
const BusinessLocation = require("./website/access-card/models/businessLocation.model");
const BusinessHour = require("./website/access-card/models/businessHour.model");
const BusinessGalleryMedia = require("./website/access-card/models/businessGalleryMedia.model");

const JournalCategory = require("./website/content/models/journalCategory.model");
const Journal = require("./website/content/models/journal.model");
const Education = require("./website/content/models/education.model");
const Shop = require("./website/content/models/shop.model");
const Event = require("./website/content/models/event.model");
const Author = require("./website/content/models/author.model");
const Directory = require("./website/access-card/models/directory.model");
const DirectoryCategory = require("./website/access-card/models/directoryCategory.model");

const GuestApplication = require("./website/inquiries/models/guestApplication.model");
const PodcastSchedule = require("./website/content/models/podcastSchedule.model");
const JournalDownload = require("./website/content/models/journalDownload.model");
const JournalShop = require("./website/content/models/journalShop.model");
const AccessOrder = require("./website/access-card/models/accessOrder.model");
const AccessCardAnalytics = require("./website/access-card/models/accessCardAnalytics.model");

const Ad = require("./website/content/models/ad.model");
const JournalFaqMapping = require("./website/content/models/journalFaqMapping.model");
const JournalTopicMapping = require("./website/content/models/journalTopicMapping.model");
const JournalFaq = require("./website/content/models/journalFaq.model");
const JournalTopic = require("./website/content/models/journalTopic.model");
const JournalTopicPodcastMapping = require("./website/content/models/journalTopicPodcastMapping.model");
const JournalTopicProductMapping = require("./website/content/models/journalTopicProductMapping.model");
const JournalTopicProfessionalMapping = require("./website/content/models/journalTopicProfessionalMapping.model");
const JournalTopicParagraphMapping = require("./website/content/models/journalTopicParagraphMapping.model");
const PartnershipInquiry = require("./website/inquiries/models/partnershipInquiry.model");

module.exports = {
  Country,
  State,
  City,
  Timezone,
  Category,
  Profession,

  Role,
  Department,

  Admin,
  User,
  UserBlock,
  UserReport,
  Profile,
  UserToken,
  AuthSession,
  EmailToken,
  UserIdentity,
  UserAttachment,
  UserLoginTiming,

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
  Availability,
  Notification,
  Booking,
  BookingSlot,

  Feed,
  Post,
  FeedPost,
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
  ReelTag,

  ServiceList,
  Service,
  ServiceAttachment,

  Permission,
  PermissionUser,


  BlogCategory,
  Blog,
  BlogAttachment,
  BlogCategoryMapping,

  Keyword,

  Story,
  Wall,
  WallStory,
  Tag,
  PostTag,

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
  Education,
  Shop,
  Event,
  Author,
  Directory,
  DirectoryCategory,
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
  User.hasMany(AuthSession, { foreignKey: "user_id", as: "auth_sessions" });
  AuthSession.belongsTo(User, { foreignKey: "user_id", as: "user" });
  User.hasMany(EmailToken, { foreignKey: "user_id", as: "email_tokens" });
  EmailToken.belongsTo(User, { foreignKey: "user_id", as: "user" });
  User.hasMany(UserIdentity, { foreignKey: "user_id", as: "identities" });
  UserIdentity.belongsTo(User, { foreignKey: "user_id", as: "user" });
  UserToken.belongsTo(User, { foreignKey: "user_id", as: "token_user" });

  UserToken.belongsTo(Profile, {
    foreignKey: "user_id",
    as: "token_user_profile",
    sourceKey: "user_id",
  });

  UserLoginTiming.belongsTo(User, { foreignKey: "user_id", as: "login_user" });
  UserLoginTiming.belongsTo(Timezone, {
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

  // Cases
  User.hasMany(Case, { foreignKey: "user_id", as: "user_cases" });
  Case.belongsTo(User, { foreignKey: "user_id", as: "filled_by" });

  User.hasMany(Case, { foreignKey: "professional_id", as: "professional_cases" });
  Case.belongsTo(User, { foreignKey: "professional_id", as: "filled_to" });

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

  User.hasMany(Slot, { foreignKey: "professional_id", as: "professional_slots" });
  Slot.belongsTo(User, { foreignKey: "professional_id", as: "slot_professional" });


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
    foreignKey: "professional_id",
    as: "professional_appointments",
  });
  Booking.belongsTo(User, {
    foreignKey: "professional_id",
    as: "appointment_professional",
  });

  BookingSlot.hasMany(Booking, {
    foreignKey: "slot_id",
    as: "slot_appointments",
  });
  Booking.belongsTo(BookingSlot, {
    foreignKey: "slot_id",
    as: "appointment_slot",
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

  //Blog

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

  Notification.belongsTo(User, { foreignKey: "sender_id", as: "sender" });
  Notification.belongsTo(User, { foreignKey: "receiver_id", as: "receiver" });

  User.hasMany(Availability, {
    foreignKey: "professional_id",
    as: "availablity_Availability",
  });
  Availability.belongsTo(User, {
    foreignKey: "professional_id",
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
    as: "professional_brand_associations",
  });
  User.hasMany(BrandAssociation, {
    foreignKey: "brand_id",
    as: "brand_professional_associations",
  });
  BrandAssociation.belongsTo(User, {
    foreignKey: "user_id",
    as: "brand_association_professional",
  });
  BrandAssociation.belongsTo(User, {
    foreignKey: "brand_id",
    as: "brand_association_brand",
  });

  User.belongsTo(User, {
    as: "referrer", // alias for the professional who referred
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

  Directory.hasMany(DirectoryCategory, {
    foreignKey: "directory_id",
    as: "directory_categories",
  });
  DirectoryCategory.belongsTo(Directory, {
    foreignKey: "directory_id",
  });

  DirectoryCategory.belongsTo(BusinessCardCategory, {
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
