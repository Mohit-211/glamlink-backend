// The website/inquiries module's tables.
const ContactUs = require('./contactUs.model');
const PartnershipInquiry = require('./partnershipInquiry.model');
const GuestApplication = require('./guestApplication.model');
const NewsletterSubscriber = require('./newsletterSubscriber.model');
const FeatureRequest = require('./featureRequest.model');

const associate = () => {};

module.exports = { models: { ContactUs, PartnershipInquiry, GuestApplication, NewsletterSubscriber, FeatureRequest }, associate };
