const express = require('express');
const router = express.Router();

const albumController = require('./album.controller');
const { authenticate } = require('../../shared/identity');


router.post('/', [authenticate], albumController.createAlbum);
router.get('/user/:id', [authenticate], albumController.getAllAlbums);
router.get('/:id', [authenticate], albumController.findAlbumById);
router.put('/:id', [authenticate], albumController.updateAlbum);
router.delete('/:id', [authenticate], albumController.deleteAlbum);

router.post('/like', [authenticate], albumController.likeAndDislikeAlbum);
router.post('/comment', [authenticate], albumController.createCommenetInAlbum);
router.get('/comment/:album_id', [authenticate], albumController.getAllCommentByAlbumId);
router.get('/like/:album_id', [authenticate], albumController.getAllLikesByAlbumId);

router.get('/attachments/:album_attachment_id', [authenticate], albumController.findAlbumAttachmentById);
router.post('/attachments/like', [authenticate], albumController.likeAndDislikeAlbumAttachment);
router.post('/attachments/comment', [authenticate], albumController.createCommenetInAlbumAttachment);
router.get('/attachments/comment/:album_attachment_id', [authenticate], albumController.getAllCommentByAlbumAttachmentId);
router.get('/attachments/like/:album_attachment_id', [authenticate], albumController.getAllLikeByAlbumAttachmentId);

module.exports = router;