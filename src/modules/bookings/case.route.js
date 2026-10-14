const express = require('express');
const router = express.Router();

const caseController = require('./case.controller');
const { authenticate } = require('../../core/auth/authenticate');

router.get('/', [authenticate], caseController.getAllCase);
router.get('/:caseId', [authenticate], caseController.caseDetail);
router.post('/attachments', [authenticate], caseController.addAttachmentToCase);
router.get('/attachments/:caseId', [authenticate], caseController.getAllCaseAttachments);
router.post('/completed', [authenticate], caseController.serviceCompleteFlag);
module.exports = router;