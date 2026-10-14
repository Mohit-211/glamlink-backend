const express = require('express');
const router = express.Router();

const categoryController = require('./category.controller');
const adminAuthMiddleware = require('../../core/auth/adminAuth.middleware');


router.post('/',[ adminAuthMiddleware.validateJWTtoken], categoryController.createCategory);
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.findCategoryById);
router.put('/:id',[ adminAuthMiddleware.validateJWTtoken], categoryController.updateCategory);
router.post('/delete',[ adminAuthMiddleware.validateJWTtoken], categoryController.deleteCategory);

module.exports = router;