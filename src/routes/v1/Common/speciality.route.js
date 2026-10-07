const express = require('express');
const router = express.Router();

const { specialityController } = require('../../../controllers');

router.post('/', specialityController.createSpeciality);
router.get('/', specialityController.getAllSpecialities);
router.get('/:id', specialityController.findSpecialityById);
router.put('/:id', specialityController.updateSpeciality);
router.delete('/:id', specialityController.deleteSpeciality);

module.exports = router;