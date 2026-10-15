const express = require('express');
const router = express.Router();
const { requireAdmin } = require('./access.middleware');

const roleController = require('./role.controller');

router.post('/' , requireAdmin, roleController.createRole);
router.get('/:id' , roleController.findRoleById);
router.get('/' , roleController.getAllRoles);
router.put('/:id' , requireAdmin, roleController.updateRole);
router.delete('/:id' , requireAdmin, roleController.deleteRole);

module.exports = router;