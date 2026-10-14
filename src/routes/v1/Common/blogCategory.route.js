const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../../middlewares/access.middleware');

const blogCategoryController = require('../../../controllers/Common/blogCategory.controller');
const adminAuthMiddleware = require('../../../middlewares/adminAuth.middleware');


router.post('/',[ adminAuthMiddleware.validateJWTtoken], blogCategoryController.createBlogCategory);
router.get('/', blogCategoryController.getAllBlogCategories);
router.get('/getBlogCategoryName', blogCategoryController.getBlogCategoryName);
router.get('/:id', blogCategoryController.findBlogCategoryById);
router.put('/:id', requireAdmin, blogCategoryController.updateBlogCategory);
router.post('/delete', requireAdmin, blogCategoryController.deleteBlogCategory);

module.exports = router;