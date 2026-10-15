const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../core/auth/access.middleware');

const adminAuthController = require('./adminAuth.controller');
const { validateJWTtoken } = require('../../core/auth/adminToken.middleware');
const adminValidation = require('../../core/auth/admin.validation');

// Only an existing admin can create another admin (Super Admin accounts come from `npm run auth`).
router.post('/register', requireAdmin, [adminValidation.validateCreateAdminBody], adminAuthController.createAdminUser);
router.post('/login', [adminValidation.validateLoginAdminBody], adminAuthController.loginAdminUser);
router.post('/change-password',  [ adminValidation.validateResetPasswordBody, validateJWTtoken], adminAuthController.resetAdminPassword);
router.post('/otp',  adminAuthController.sendOTP);
router.post('/verify-otp',  adminAuthController.verifyOTP);
router.post('/forgot-password',  adminAuthController.forgotAdminPassword);

module.exports = router;