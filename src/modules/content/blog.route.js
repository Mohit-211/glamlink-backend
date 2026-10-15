const express = require('express');
const router = express.Router();

const blogController = require('./blog.controller');
const blogValidation = require('../../core/auth/blog.validation');
const { validateJWTtoken } = require('../../core/auth/adminToken.middleware');

router.post('/', [ validateJWTtoken, blogValidation.validateNewBlogBody ], blogController.createBlog);
router.get('/', blogController.getAllBlogByToken);
router.get('/:blog_id', blogController.blogDetailById);
router.put('/update/:id', [ validateJWTtoken ], blogController.updateBlog);
router.post('/delete', [ validateJWTtoken ], blogController.deleteBlog);


module.exports = router;

