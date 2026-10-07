const express = require('express');
const router = express.Router();

const { professionController } = require('../../../controllers');
const {adminAuthMiddleware} = require('../../../middlewares');


router.post('/',[ adminAuthMiddleware.validateJWTtoken], professionController.createProfession);
router.get('/', professionController.getAllProfessions);
router.get('/:id', professionController.findProfessionById);
router.put('/:id',[ adminAuthMiddleware.validateJWTtoken], professionController.updateProfession);
router.post('/delete',[ adminAuthMiddleware.validateJWTtoken], professionController.deleteProfession);


router.get('/getUsersByProfessionId/:id', professionController.getUsersByProfessionId);

module.exports = router;