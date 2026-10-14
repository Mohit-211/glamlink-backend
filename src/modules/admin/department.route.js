const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../core/auth/access.middleware');

const departmentController = require('./department.controller');

router.post('/', requireAdmin, departmentController.createDepartment);
router.get('/', departmentController.getAllDeparments);
router.get('/:id', departmentController.findDepartmentById);
router.put('/:id', requireAdmin, departmentController.updateDepartment);
router.delete('/:id', requireAdmin, departmentController.deleteDepartment);

module.exports = router;