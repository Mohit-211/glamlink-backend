const express = require('express');
const router = express.Router();

const { adminOpController } = require('../../../controllers');
const { adminAuthMiddleware } = require('../../../middlewares');

router.get('/profile', [adminAuthMiddleware.validateJWTtoken], adminOpController.getAdminProfile);
router.put('/profile/:id', [adminAuthMiddleware.validateJWTtoken], adminOpController.updateAdminProfile);
router.delete('/deleteAdmin', [adminAuthMiddleware.validateJWTtoken], adminOpController.deleteAdmin);
router.get('/list', [adminAuthMiddleware.validateJWTtoken], adminOpController.getAllAdmin);
router.get('/users/list/:roleId', [adminAuthMiddleware.validateJWTtoken], adminOpController.getAllUsers);
router.get('/users/getUserById/:id',  adminOpController.getUserById);
router.post('/users/delete', [adminAuthMiddleware.validateJWTtoken], adminOpController.deleteUser);
router.get('/appointment/prices', [adminAuthMiddleware.validateJWTtoken], adminOpController.getDefaultPrices);
router.get('/user/login/timings', [adminAuthMiddleware.validateJWTtoken], adminOpController.getUserLoginTimings);
router.delete('/user/login/timings/clear', [adminAuthMiddleware.validateJWTtoken], adminOpController.clearLoginRecords);

router.post('/user/promoted', [adminAuthMiddleware.validateJWTtoken], adminOpController.promotedToogle);
router.post('/user/unpromoted', adminOpController.unpromote);
router.post('/user/unpromotedAll', adminOpController.unpromoteAll);
router.get('/user/getUserPromotions/:id', adminOpController.getUserPromotions);
router.get('/user/getAllPromotionRequest',adminOpController.getAllPromotionRequest);

router.get('/home/counts', [adminAuthMiddleware.validateJWTtoken], adminOpController.getTotalCounts);
router.get('/home/payments', [adminAuthMiddleware.validateJWTtoken], adminOpController.getAllTransaction);
router.get('/home/payments/all', [adminAuthMiddleware.validateJWTtoken], adminOpController.getAllTransactionAdminPanel);
router.get('/home/appointments/all', [adminAuthMiddleware.validateJWTtoken], adminOpController.getAllAppointment);

// User Related APIs
router.post('/user/approved', [adminAuthMiddleware.validateJWTtoken], adminOpController.approvedUserProfile);

router.get('/counselor/fees/change/list', [adminAuthMiddleware.validateJWTtoken], adminOpController.getAllPriceChangeRequest);
router.post('/counselor/fees/change/approved', [adminAuthMiddleware.validateJWTtoken], adminOpController.approvedUserPriceChangeRequest);
router.post('/counselor/fees/change/reject', [adminAuthMiddleware.validateJWTtoken], adminOpController.rejectUserPriceChangeRequest);
router.get('/counselor/pending/list', [adminAuthMiddleware.validateJWTtoken], adminOpController.getAllCounselorApprovalRequest);

//Permission
router.get('/permissions', [adminAuthMiddleware.validateJWTtoken], adminOpController.getAllPermission);
router.post('/permissions', [adminAuthMiddleware.validateJWTtoken], adminOpController.updatePermissionByUserId);

router.post('/user/create', [adminAuthMiddleware.validateJWTtoken, adminAuthMiddleware.validateCreateUserBody], adminOpController.createUser);

router.get('/posts', [adminAuthMiddleware.validateJWTtoken], adminOpController.getAllPost);
router.post('/posts/delete', [adminAuthMiddleware.validateJWTtoken], adminOpController.deletePostById);

router.get('/reels', [adminAuthMiddleware.validateJWTtoken], adminOpController.getAllReel);
router.post('/reels/delete', [adminAuthMiddleware.validateJWTtoken], adminOpController.deleteReelById);


router.get('/services', [adminAuthMiddleware.validateJWTtoken], adminOpController.getAllService);
router.delete('/services/:id', [adminAuthMiddleware.validateJWTtoken], adminOpController.deleteServiceById);

router.post('/service-list', [adminAuthMiddleware.validateNewServiceListBody,  adminAuthMiddleware.validateJWTtoken], adminOpController.createServiceList);
router.put('/updateServiceList/:id', adminOpController.updateServiceList);
router.post('/deleteServiceList', adminOpController.deleteServiceList);

router.post('/create-service-list', adminOpController.createServiceListUsingCSV);

router.post('/foundersToogle', [adminAuthMiddleware.validateJWTtoken], adminOpController.foundersToogle);
router.get('/getAllReferral', adminOpController.getAllReferral);
router.get('/getAllReferralByBeauticianId/:id', adminOpController.getAllReferralByBeauticianId);


// glam coin
router.get('/getAllGlamCoinRules', adminOpController.getAllGlamCoinRules);
router.put('/editGlamCoinRules/:id', adminOpController.editGlamCoinRules);

module.exports = router;
