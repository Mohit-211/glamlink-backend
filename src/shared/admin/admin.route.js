const express = require('express');
const router = express.Router();
const { requireAdmin } = require('./access.middleware');

// Every route in this router is admin-only.
router.use(requireAdmin);

const adminController = require('./admin.controller');
const adminValidation = require('./admin.validation');

router.get('/profile', adminController.getAdminProfile);
router.put('/profile/:id', adminController.updateAdminProfile);
router.delete('/deleteAdmin', adminController.deleteAdmin);
router.get('/list', adminController.getAllAdmin);
router.get('/users/list/:roleId', adminController.getAllUsers);
router.get('/users/getUserById/:id',  adminController.getUserById);
router.post('/users/delete', adminController.deleteUser);
router.get('/user/login/timings', adminController.getUserLoginTimings);
router.delete('/user/login/timings/clear', adminController.clearLoginRecords);
router.get('/home/counts', adminController.getTotalCounts);
router.get('/home/payments', adminController.getAllTransaction);
router.get('/home/payments/all', adminController.getAllTransactionAdminPanel);
// User Related APIs
router.post('/user/approved', adminController.approvedUserProfile);
//Permission
router.get('/permissions', adminController.getAllPermission);
router.post('/permissions', adminController.updatePermissionByUserId);
router.post('/user/create', [adminValidation.validateCreateUserBody], adminController.createUser);
router.post('/foundersToogle', adminController.foundersToggle);

module.exports = router;
