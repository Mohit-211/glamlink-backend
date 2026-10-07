const express = require('express');
const router = express.Router();

const { professionsalFormController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');



router.post('/createQuestions', professionsalFormController.createQuestions);
router.get('/getAllQuestions', professionsalFormController.getAllQuestions);
router.put('/editQuestion/:id', professionsalFormController.editQuestion);
router.delete('/deleteQuestion/:id', professionsalFormController.deleteQuestion);
router.post('/updateStatus/:id', professionsalFormController.updateStatus);
router.post('/deleteForm/:id', professionsalFormController.deleteForm);
router.get('/getPendingFormCount', professionsalFormController.getPendingFormCount);

router.post('/submitForm',[userAuthMiddleware.verifyAuthJWTToken], professionsalFormController.submitForm);



router.get('/getUsersWhoSubmittedForm', professionsalFormController.getUsersWhoSubmittedForm);
router.get('/getAllAnswersByUserId/:id', professionsalFormController.getAllAnswersByUserId);






module.exports = router;

