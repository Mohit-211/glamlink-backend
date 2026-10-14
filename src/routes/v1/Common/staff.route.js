const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../../middlewares/access.middleware');

const { staffController} = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

router.post('/createStaff',[userAuthMiddleware.verifyAuthJWTToken],  staffController.createStaff);
router.get('/getAllStaff', [userAuthMiddleware.verifyAuthJWTToken], staffController.getAllStaff);
router.get('/getStaffById/:id', requireAdmin,  staffController.getStaffById);
router.put('/updateStaff/:id', [userAuthMiddleware.verifyAuthJWTToken],  staffController.updateStaff);
router.post('/deleteStaff', requireAdmin, staffController.deleteStaff);
router.post('/importStaff',[userAuthMiddleware.verifyAuthJWTToken],  staffController.importStaff);

module.exports = router;