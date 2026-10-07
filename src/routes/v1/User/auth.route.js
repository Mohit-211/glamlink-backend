const express = require('express');
const router = express.Router();

const { userAuthController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

router.use(userAuthMiddleware.setRoleIdIfNotPresent);


// router.post("/test-header", (req, res) => {
//   return res.json({
//     headers: req.headers,
//     rawHeaders: req.rawHeaders,
//   });
// });

router.post('/otp', userAuthController.sendOTP);
router.post('/verify-otp', userAuthController.verifyOTP);
router.post('/register', [userAuthMiddleware.validateRegisterUserBody], userAuthController.register);
router.post('/sso', [userAuthMiddleware.validateSSOUserBody], userAuthController.singleSignOn);

router.post('/login', [userAuthMiddleware.validateSignInReqBody], userAuthController.login);
router.post('/reset-password', [userAuthMiddleware.verifyAuthJWTToken], userAuthController.resetPassword);
router.post('/forgot-password', [userAuthMiddleware.validateForgetPassordToken], userAuthController.forgotPassword);
router.get('/logout', [userAuthMiddleware.verifyAuthJWTToken], userAuthController.logout);



module.exports = router;
