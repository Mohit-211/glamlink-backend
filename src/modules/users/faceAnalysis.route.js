const express = require('express');
const router = express.Router();

const faceAnalysisController = require('./faceAnalysis.controller');
const { authenticate } = require('../../core/auth/authenticate');

router.post('/analyze-face', [authenticate], faceAnalysisController.analyzeSkin);

module.exports = router;
