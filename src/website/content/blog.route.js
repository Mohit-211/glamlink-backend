const express = require('express');
const router = express.Router();

const blogController = require('./blog.controller');
const blogValidation = require('./blog.validation');
const { requireAdmin } = require('../../shared/admin');

router.post('/', [requireAdmin, blogValidation.validateNewBlogBody], blogController.createBlog);
router.get('/', blogController.getAllBlogByToken);
router.get('/:blog_id', blogController.blogDetailById);
router.put('/update/:id', [requireAdmin], blogController.updateBlog);
router.post('/delete', [requireAdmin], blogController.deleteBlog);


module.exports = router;

