const express = require('express');
const config = require('../../core/config/config');
const { authLimiter } = require('../../core/http/rateLimiter');
const { authenticate } = require('./authenticate');
const auth = require('./auth.controller');

const router = express.Router();

// Guessable steps are rate limited per IP in production. Refresh and sign-out are not: every signed-in
// device refreshes every few minutes, and many people can share one office IP.
const limited = config.env === 'production' ? [authLimiter] : [];

router.post('/register', limited, auth.register);
router.post('/verify-email', limited, auth.verifyEmail);
router.post('/resend-verification', limited, auth.resendVerification);
router.post('/login', limited, auth.login);
router.post('/refresh', auth.refresh);
router.post('/logout', authenticate, auth.logout);
router.post('/logout-all', authenticate, auth.logoutEverywhere);
router.post('/forgot-password', limited, auth.forgotPassword);
router.post('/reset-password', limited, auth.resetPassword);
router.post('/change-password', limited, authenticate, auth.changePassword);
// Google sign-in comes later (verified on the server against Google's keys); identities are already linked.
router.post('/sso', (req, res) => res.status(501).json({ success: false, status: 501, message: 'Social sign-in is not available yet.', data: '' }));

module.exports = router;
