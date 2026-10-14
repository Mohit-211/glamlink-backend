const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../../middlewares/access.middleware');

const { professionsalFormController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');



router.post('/createQuestions', requireAdmin, professionsalFormController.createQuestions);
router.get('/getAllQuestions', professionsalFormController.getAllQuestions);
router.put('/editQuestion/:id', requireAdmin, professionsalFormController.editQuestion);
router.delete('/deleteQuestion/:id', requireAdmin, professionsalFormController.deleteQuestion);
router.post('/updateStatus/:id', requireAdmin, professionsalFormController.updateStatus);
router.post('/deleteForm/:id', requireAdmin, professionsalFormController.deleteForm);
router.get('/getPendingFormCount', requireAdmin, professionsalFormController.getPendingFormCount);

router.post('/submitForm',[userAuthMiddleware.verifyAuthJWTToken], professionsalFormController.submitForm);



router.get('/getUsersWhoSubmittedForm', requireAdmin, professionsalFormController.getUsersWhoSubmittedForm);
router.get('/getAllAnswersByUserId/:id', requireAdmin, professionsalFormController.getAllAnswersByUserId);






module.exports = router;

