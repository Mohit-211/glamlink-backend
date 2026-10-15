const express = require('express');
const router = express.Router();

const professionController = require('./profession.controller');
const { requireAdmin } = require('../admin');


router.post('/',[requireAdmin], professionController.createProfession);
router.get('/', professionController.getAllProfessions);
router.get('/:id', professionController.findProfessionById);
router.put('/:id',[requireAdmin], professionController.updateProfession);
router.post('/delete',[requireAdmin], professionController.deleteProfession);


router.get('/getUsersByProfessionId/:id', professionController.getUsersByProfessionId);

module.exports = router;