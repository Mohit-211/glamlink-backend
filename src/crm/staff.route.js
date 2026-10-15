const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../shared/admin');

const staffController = require('./staff.controller');
const { authenticate } = require('../shared/identity');

router.post('/createStaff',[authenticate],  staffController.createStaff);
router.get('/getAllStaff', [authenticate], staffController.getAllStaff);
router.get('/getStaffById/:id', requireAdmin,  staffController.getStaffById);
router.put('/updateStaff/:id', [authenticate],  staffController.updateStaff);
router.post('/deleteStaff', requireAdmin, staffController.deleteStaff);
router.post('/importStaff',[authenticate],  staffController.importStaff);

module.exports = router;