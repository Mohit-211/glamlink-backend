const express = require('express');
const router = express.Router();

const { albumController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');


router.post('/', [userAuthMiddleware.verifyAuthJWTToken], albumController.createAlbum);
router.get('/user/:id', [userAuthMiddleware.verifyAuthJWTToken], albumController.getAllAlbums);
router.get('/:id', [userAuthMiddleware.verifyAuthJWTToken], albumController.findAlbumById);
router.put('/:id', [userAuthMiddleware.verifyAuthJWTToken], albumController.updateAlbum);
router.delete('/:id', [userAuthMiddleware.verifyAuthJWTToken], albumController.deleteAlbum);

router.post('/like', [userAuthMiddleware.verifyAuthJWTToken], albumController.likeAndDislikeAlbum);
router.post('/comment', [userAuthMiddleware.verifyAuthJWTToken], albumController.createCommenetInAlbum);
router.get('/comment/:album_id', [userAuthMiddleware.verifyAuthJWTToken], albumController.getAllCommentByAlbumId);
router.get('/like/:album_id', [userAuthMiddleware.verifyAuthJWTToken], albumController.getAllLikesByAlbumId);

router.get('/attachments/:album_attachment_id', [userAuthMiddleware.verifyAuthJWTToken], albumController.findAlbumAttachmentById);
router.post('/attachments/like', [userAuthMiddleware.verifyAuthJWTToken], albumController.likeAndDislikeAlbumAttachment);
router.post('/attachments/comment', [userAuthMiddleware.verifyAuthJWTToken], albumController.createCommenetInAlbumAttachment);
router.get('/attachments/comment/:album_attachment_id', [userAuthMiddleware.verifyAuthJWTToken], albumController.getAllCommentByAlbumAttachmentId);
router.get('/attachments/like/:album_attachment_id', [userAuthMiddleware.verifyAuthJWTToken], albumController.getAllLikeByAlbumAttachmentId);

module.exports = router;