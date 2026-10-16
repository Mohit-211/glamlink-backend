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

const productionOnly = (limiter) => (config.env === 'production' ? limiter : (req, res, next) => next());

module.exports = {
  authLimiter,
  limitGuestCards: productionOnly(guestCardLimiter),
};
