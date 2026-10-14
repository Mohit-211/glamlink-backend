const express = require('express');
const router = express.Router();

const caseController = require('../../../controllers/Common/case.controller');
const userAuthMiddleware = require('../../../middlewares/userAuth.middleware');

router.get('/', [userAuthMiddleware.verifyAuthJWTToken], caseController.getAllCase);
router.get('/:caseId', [userAuthMiddleware.verifyAuthJWTToken], caseController.caseDetail);
router.post('/attachments', [userAuthMiddleware.verifyAuthJWTToken], caseController.addAttachmentToCase);
router.get('/attachments/:caseId', [userAuthMiddleware.verifyAuthJWTToken], caseController.getAllCaseAttachments);
router.post('/completed', [userAuthMiddleware.verifyAuthJWTToken], caseController.serviceCompleteFlag);
module.exports = router;