const roleController = require("./role.controller");
const departmentController = require("./department.controller");
const faqController = require("./faq.controller");
const contactUsController = require("./contactUs.controller");
const countryController = require("./country.controller");
const stateController = require("./state.controller");
const cityController = require("./city.controller");
const reviewController = require("./review.controller");
const languageController = require("./language.controller");
const appointmentController = require("./appointment.controller");
const priceController = require("./price.controller");
const caseController = require("./case.controller");
const chatController = require("./chat.controller");
const postController = require("./post.controller");
const serviceController = require("./service.controller");
const reelController = require("./reel.controller");
const categoryController = require("./category.controller");
const professionController = require("./profession.controller");
const blogCategoryController = require("./blogCategory.controller");
const blogController = require("./blog.controller");
const keywordController = require("./keyword.controller");
const storyController = require("./story.controller");
const albumController = require("./album.controller");
const notificationController = require("./notification.controller");

// e-commerce controller
const productCategoryController = require("./productCategory.controller");
const productController = require("./product.controller");
const productReviewController = require("./productReview.controller");
const wishlistController = require("./wishlist.controller");
const cartController = require("./cart.controller");
const orderController = require("./order.controller");
const brandController = require("./brand.controller");
const vendorController = require("./vendor.controller");
const productTypeController = require("./productType.controller");
const numeralTaxController = require("./numeralTaxCategory.controller");
const numeralController = require("./numeral.controller");

// crm controller
const customerController = require("./customer.controller");
const crmPaymentController = require("./crmPayment.controller");

const stripeOrderPayment = require("./stripeOrderPayment.controller");
const stripeCRMPayment = require("./stripeCRMPayment.controller");
const professionsalFormController = require("./professionalForm.controller");
const stripeController = require("./stripe.controller");
const shippoController = require("./shippo.controller");
const bannerController = require("./bannerMedia.controller");
const promotionController = require("./promotion.controller");
const staffController = require("./staff.controller");

const guestController = require("./guest.controller");

const businessCardController = require("./businessCard.controller");
const accessCardAnalyticsController = require("./accessCardAnalytics.controller");

const journalCategoryController = require("./journalCategory.controller");
const authorController = require("./author.controller");
const journalController = require("./journal.controller");
const discoverController = require("./discover.controller");

const guestApplicationController = require("./guestApplication.controller");

const podcastScheduleController = require("./podcastSchedule.controller");
const addController = require("./ad.controller");
const partnershipInquiryController = require("./partnershipInquiry.controller");

module.exports = {
  roleController,
  departmentController,
  faqController,
  contactUsController,
  countryController,
  stateController,
  cityController,
  reviewController,
  languageController,
  appointmentController,
  priceController,
  caseController,
  chatController,
  postController,
  serviceController,
  reelController,
  categoryController,
  professionController,
  blogCategoryController,
  blogController,
  keywordController,
  storyController,
  albumController,
  notificationController,

  productCategoryController,
  productController,
  productReviewController,
  wishlistController,
  cartController,
  orderController,
  brandController,
  vendorController,
  productTypeController,
  numeralTaxController,
  numeralController,

  customerController,
  crmPaymentController,
  stripeOrderPayment,
  stripeCRMPayment,
  professionsalFormController,
  stripeController,
  shippoController,
  bannerController,
  promotionController,
  staffController,
  guestController,

  businessCardController,
  journalCategoryController,
  authorController,
  journalController,
  discoverController,
  guestApplicationController,
  podcastScheduleController,
  addController,
  accessCardAnalyticsController,
  partnershipInquiryController
};
