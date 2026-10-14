const express = require('express');
const router = express.Router();

const { userAuthController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

router.use(userAuthMiddleware.setRoleIdIfNotPresent);


router.post('/otp', userAuthController.sendOTP);
router.post('/verify-otp', userAuthController.verifyOTP);
router.post('/register', [userAuthMiddleware.validateRegisterUserBody], userAuthController.register);
// SSO is disabled until provider tokens (Google/Apple/Facebook) are verified server-side; it accepted any email.
router.post('/sso', (req, res) => res.status(501).json({ success: false, status: 501, message: 'Social sign-in is temporarily unavailable.', data: '' }));

router.post('/login', [userAuthMiddleware.validateSignInReqBody], userAuthController.login);
router.post('/reset-password', [userAuthMiddleware.verifyAuthJWTToken], userAuthController.resetPassword);
router.post('/forgot-password', [userAuthMiddleware.validateForgetPassordToken], userAuthController.forgotPassword);
router.get('/logout', [userAuthMiddleware.verifyAuthJWTToken], userAuthController.logout);



module.exports = router;
