const roleService = require('./role.service');
const departmentService = require('./department.service');
const faqService = require('./faq.service');
const contactUsService = require('./contactUs.service');
const emailService = require('./email.service');
const tokenService = require('./token.service');
const countryService = require('./country.service');
const stateService = require('./state.service');
const cityService = require('./city.service');

const reviewService = require('./review.service');
const languageService = require('./language.service');
const appointmentService = require('./appointment.service');
const priceService = require('./price.service');
const caseService = require('./case.service');
const chatService = require('./chat.service');
const postService = require('./post.service');
const serviceService = require('./service.service');
const reelService = require('./reels.service');
const categoryService = require('./category.service');
const professionService = require('./profession.service');
const blogCategoryService = require('./blogCategory.service');
const blogService = require('./blog.service');
const keywordService = require('./keyword.service');
const storyService = require('./story.service');
const albumService = require('./album.service');
const notificationService = require('./notification.service');


// e-commerce services
const productCategoryService = require('./productCategory.service');
const productService = require('./product.service');
const productReviewService = require('./productReview.service');
const wishListService = require('./wishList.service');
const cartService = require('./cart.service');
const orderService = require('./order.service');
const brandService = require("./brand.service");
const vendorService = require("./vendor.service");
const productTypeService = require("./productType.service");
const numeralTaxCategoryService  = require('./numeralTaxCategory.service');
const numeralService = require("./numeral.service")

// crm services
const customerService = require('./customer.service');
const professionsalFormService = require("./professionalForm.service");
const stripeServices = require('./stripe.service');
const bannerService = require("./bannerMedia.service");
const promotionService = require("./promotion.service");
const staffService = require('./staff.service');

const guestService = require('./guest.service');

const businessCardService = require("./businessCard.service");
const accessCardAnalyticsService = require("./accessCardAnalytics.service");

const journalCategoryService = require('./journalCategory.service');
const authorService = require('./author.service');
const journalService = require('./journal.service');
const discoverService = require("./discover.service")

const guestApplicationService = require("./guestApplication.service");

const podcastScheduleService = require("./podcastSchedule.service");
const adService = require("./ad.service");
const partnershipInquiryService = require("./partnershipInquiry.service");


module.exports = {
    roleService,
    departmentService,
    faqService,
    contactUsService,
    emailService,
    tokenService,
    countryService,
    stateService,
    cityService,
    reviewService,
    languageService,
    appointmentService,
    priceService,
    caseService,
    chatService,
    postService,
    serviceService,
    reelService,
    categoryService,
    professionService,
    blogCategoryService,
    blogService,
    keywordService,
    storyService,
    albumService,
    notificationService,
    productCategoryService,
    productService,
    productReviewService,
    wishListService,
    cartService,
    orderService,
    customerService,
    brandService,
    vendorService,
    productTypeService,
    professionsalFormService,
    numeralTaxCategoryService,
    numeralService,
    stripeServices,
    bannerService,
    promotionService,
    staffService,
    guestService,
    businessCardService,
    accessCardAnalyticsService,
    journalCategoryService,
    authorService,
    journalService,
    discoverService,
    guestApplicationService,
    podcastScheduleService,
    adService,
    partnershipInquiryService
};