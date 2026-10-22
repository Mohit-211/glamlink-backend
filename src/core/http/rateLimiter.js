const rateLimit = require('express-rate-limit');
const config = require('../config/config');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 15,                // max 15 requests per IP in 15 min
  skipSuccessfulRequests: false, // count ALL requests (important against bots)
  message: {
    success: false,
    status: 429,
    message: 'Too many requests from this IP, please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Cards made by guests (POST /businessCard): each can become an account and a live card with one more call, so
// one address may make 10 an hour. Refused attempts (a form error) don't count. Production only.
const guestCardLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  skipFailedRequests: true,
  message: {
    success: false,
    status: 429,
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many cards from this address. Please try again in an hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// The website's public forms that store what they are sent (newsletter, feature requests, directory
// applications): 20 an hour from one address, all forms together. Production only.
const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  message: {
    success: false,
    status: 429,
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many submissions from this address. Please try again in an hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// The site-wide search: 60 a minute from one address (a person typing; not a scraper). Production only.
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  message: {
    success: false,
    status: 429,
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many searches. Please wait a moment.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Ad views and clicks from the website: 300 a minute from one address (a page shows several ads). Production only.
const adEventLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  message: { success: false, status: 429, code: 'TOO_MANY_REQUESTS', message: 'Too many ad events.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Page views and clicks from the website: 120 a minute from one address (a person reading pages). Production only.
const pageEventLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  message: { success: false, status: 429, code: 'TOO_MANY_REQUESTS', message: 'Too many page events.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// The directory's Google listings, searches and details (each a paid Google call): 30 a minute from one address;
// their photos: 300 a minute (a page shows 20). Production only.
const googleLookupLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  message: { success: false, status: 429, code: 'TOO_MANY_REQUESTS', message: 'Too many searches. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const googlePhotoLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  message: { success: false, status: 429, code: 'TOO_MANY_REQUESTS', message: 'Too many photos. Please wait a moment.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const productionOnly = (limiter) => (config.env === 'production' ? limiter : (req, res, next) => next());

module.exports = {
  authLimiter,
  limitGuestCards: productionOnly(guestCardLimiter),
  limitPublicForms: productionOnly(publicFormLimiter),
  limitSearches: productionOnly(searchLimiter),
  limitAdEvents: productionOnly(adEventLimiter),
  limitPageEvents: productionOnly(pageEventLimiter),
  limitGoogleLookups: productionOnly(googleLookupLimiter),
  limitGooglePhotos: productionOnly(googlePhotoLimiter),
};
