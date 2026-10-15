const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../core/auth/access.middleware');

const adminAuthController = require('./adminAuth.controller');
const adminAuthMiddleware = require('../../core/auth/adminAuth.middleware');

// Only an existing admin can create another admin (Super Admin accounts come from `npm run auth`).
router.post('/register', requireAdmin, [adminAuthMiddleware.validateCreateAdminBody], adminAuthController.createAdminUser);
router.post('/login', [adminAuthMiddleware.validateLoginAdminBody], adminAuthController.loginAdminUser);
router.post('/change-password',  [ adminAuthMiddleware.validateResetPasswordBody, adminAuthMiddleware.validateJWTtoken], adminAuthController.resetAdminPassword);
router.post('/otp',  adminAuthController.sendOTP);
router.post('/verify-otp',  adminAuthController.verifyOTP);
router.post('/forgot-password',  adminAuthController.forgotAdminPassword);

module.exports = router;