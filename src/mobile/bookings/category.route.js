const express = require('express');
const router = express.Router();

const categoryController = require('./category.controller');
const { validateJWTtoken } = require('../../shared/admin');


router.post('/',[ validateJWTtoken], categoryController.createCategory);
router.get('/', categoryController.getAllCategories);
router.get('/:id', categoryController.findCategoryById);
router.put('/:id',[ validateJWTtoken], categoryController.updateCategory);
router.post('/delete',[ validateJWTtoken], categoryController.deleteCategory);

module.exports = router;