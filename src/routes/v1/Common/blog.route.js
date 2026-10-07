const express = require('express');
const router = express.Router();

const { blogController } = require('../../../controllers');
const { userAuthMiddleware, adminAuthMiddleware } = require('../../../middlewares');

router.post('/', [ adminAuthMiddleware.validateJWTtoken, userAuthMiddleware.validateNewBlogBody ], blogController.createBlog);
router.get('/', blogController.getAllBlogByToken);
router.get('/:blog_id', blogController.blogDetailById);
router.put('/update/:id', [ adminAuthMiddleware.validateJWTtoken ], blogController.updateBlog);
router.post('/delete', [ adminAuthMiddleware.validateJWTtoken ], blogController.deleteBlog);


module.exports = router;

