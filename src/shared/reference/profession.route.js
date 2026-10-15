const express = require('express');
const router = express.Router();

const professionController = require('./profession.controller');
const { validateJWTtoken } = require('../admin/adminToken.middleware');


router.post('/',[ validateJWTtoken], professionController.createProfession);
router.get('/', professionController.getAllProfessions);
router.get('/:id', professionController.findProfessionById);
router.put('/:id',[ validateJWTtoken], professionController.updateProfession);
router.post('/delete',[ validateJWTtoken], professionController.deleteProfession);


router.get('/getUsersByProfessionId/:id', professionController.getUsersByProfessionId);

module.exports = router;