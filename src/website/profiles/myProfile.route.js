const express = require('express');
const router = express.Router();
const { requireProfessional } = require('../../shared/identity');
const { requireAnalyticsPlan } = require('../access-card');
const myProfileController = require('./myProfile.controller');
const { mine } = require('./profileContent.controller');

// The signed-in professional's or brand's own page. Its analytics are Access Pro's, as the card's are (Oct 23).
router.get('/', requireProfessional, myProfileController.getMyPage);
router.put('/', requireProfessional, myProfileController.updateMyPage);
router.get('/analytics', requireProfessional, requireAnalyticsPlan, myProfileController.analytics);

// Its Media & Images and Education (every plan, Nov 3), and images for its articles' text
router.get('/media', requireProfessional, mine.listMedia);
router.post('/media', requireProfessional, mine.addMedia);
router.post('/media/import-card', requireProfessional, mine.importCardMedia);
router.put('/media/order', requireProfessional, mine.orderMedia);
router.put('/media/:id', requireProfessional, mine.updateMedia);
router.delete('/media/:id', requireProfessional, mine.deleteMedia);
router.get('/education', requireProfessional, mine.listEducation);
router.post('/education', requireProfessional, mine.addEducation);
router.put('/education/order', requireProfessional, mine.orderEducation);
router.get('/education/:id', requireProfessional, mine.getEducation);
router.put('/education/:id', requireProfessional, mine.updateEducation);
router.delete('/education/:id', requireProfessional, mine.deleteEducation);
router.post('/uploads', requireProfessional, mine.uploadImage);

module.exports = router;
