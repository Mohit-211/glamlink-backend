const express = require('express');
const router = express.Router();

const { staffController} = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

router.post('/createStaff',[userAuthMiddleware.verifyAuthJWTToken],  staffController.createStaff);
router.get('/getAllStaff', [userAuthMiddleware.verifyAuthJWTToken], staffController.getAllStaff);
router.get('/getStaffById/:id',  staffController.getStaffById);
router.put('/updateStaff/:id', [userAuthMiddleware.verifyAuthJWTToken],  staffController.updateStaff);
router.post('/deleteStaff', staffController.deleteStaff);
router.post('/importStaff',[userAuthMiddleware.verifyAuthJWTToken],  staffController.importStaff);

module.exports = router;