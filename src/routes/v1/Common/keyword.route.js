const express = require('express');
const router = express.Router();

const { keywordController } = require('../../../controllers');
const {adminAuthMiddleware} = require('../../../middlewares');


router.post('/',[ adminAuthMiddleware.validateJWTtoken], keywordController.createKeyword);
router.get('/', keywordController.getAllCategories);
router.get('/:id', keywordController.findKeywordById);
router.put('/:id',[ adminAuthMiddleware.validateJWTtoken], keywordController.updateKeyword);
router.delete('/:id',[ adminAuthMiddleware.validateJWTtoken], keywordController.deleteKeyword);

module.exports = router;