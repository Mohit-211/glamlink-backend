const express = require('express');
const router = express.Router();

const { blogCategoryController } = require('../../../controllers');
const {adminAuthMiddleware} = require('../../../middlewares');


router.post('/',[ adminAuthMiddleware.validateJWTtoken], blogCategoryController.createBlogCategory);
router.get('/', blogCategoryController.getAllBlogCategories);
router.get('/getBlogCategoryName', blogCategoryController.getBlogCategoryName);
router.get('/:id', blogCategoryController.findBlogCategoryById);
router.put('/:id', blogCategoryController.updateBlogCategory);
router.post('/delete', blogCategoryController.deleteBlogCategory);

module.exports = router;