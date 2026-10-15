const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../core/auth/access.middleware');

// Every route in this router is admin-only.
router.use(requireAdmin);

const adminController = require('./admin.controller');
const { validateJWTtoken } = require('../../core/auth/adminToken.middleware');
const adminValidation = require('../../core/auth/admin.validation');

router.get('/profile', [validateJWTtoken], adminController.getAdminProfile);
router.put('/profile/:id', [validateJWTtoken], adminController.updateAdminProfile);
router.delete('/deleteAdmin', [validateJWTtoken], adminController.deleteAdmin);
router.get('/list', [validateJWTtoken], adminController.getAllAdmin);
router.get('/users/list/:roleId', [validateJWTtoken], adminController.getAllUsers);
router.get('/users/getUserById/:id',  adminController.getUserById);
router.post('/users/delete', [validateJWTtoken], adminController.deleteUser);
router.get('/user/login/timings', [validateJWTtoken], adminController.getUserLoginTimings);
router.delete('/user/login/timings/clear', [validateJWTtoken], adminController.clearLoginRecords);
router.get('/home/counts', [validateJWTtoken], adminController.getTotalCounts);
router.get('/home/payments', [validateJWTtoken], adminController.getAllTransaction);
router.get('/home/payments/all', [validateJWTtoken], adminController.getAllTransactionAdminPanel);
// User Related APIs
router.post('/user/approved', [validateJWTtoken], adminController.approvedUserProfile);
//Permission
router.get('/permissions', [validateJWTtoken], adminController.getAllPermission);
router.post('/permissions', [validateJWTtoken], adminController.updatePermissionByUserId);
router.post('/user/create', [validateJWTtoken, adminValidation.validateCreateUserBody], adminController.createUser);
router.post('/foundersToogle', [validateJWTtoken], adminController.foundersToggle);

module.exports = router;
