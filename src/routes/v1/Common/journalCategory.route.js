const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../../middlewares/access.middleware');

const {  journalCategoryController } = require('../../../controllers');



router.post('/', requireAdmin, journalCategoryController.createCategory);
router.get('/', journalCategoryController.getAllCategories);
router.get('/:id', journalCategoryController.findCategoryById);
router.put('/:id', requireAdmin, journalCategoryController.updateCategory);
router.post('/delete', requireAdmin, journalCategoryController.deleteCategory);
module.exports = router;