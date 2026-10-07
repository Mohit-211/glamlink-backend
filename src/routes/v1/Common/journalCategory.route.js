const express = require('express');
const router = express.Router();

const {  journalCategoryController } = require('../../../controllers');



router.post('/', journalCategoryController.createCategory);
router.get('/', journalCategoryController.getAllCategories);
router.get('/:id', journalCategoryController.findCategoryById);
router.put('/:id', journalCategoryController.updateCategory);
router.post('/delete', journalCategoryController.deleteCategory);
module.exports = router;