const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../shared/admin/access.middleware');

const blogCategoryController = require('./blogCategory.controller');
const { validateJWTtoken } = require('../../shared/admin/adminToken.middleware');


router.post('/',[ validateJWTtoken], blogCategoryController.createBlogCategory);
router.get('/', blogCategoryController.getAllBlogCategories);
router.get('/getBlogCategoryName', blogCategoryController.getBlogCategoryName);
router.get('/:id', blogCategoryController.findBlogCategoryById);
router.put('/:id', requireAdmin, blogCategoryController.updateBlogCategory);
router.post('/delete', requireAdmin, blogCategoryController.deleteBlogCategory);

module.exports = router;