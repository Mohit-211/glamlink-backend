const express = require('express');
const router = express.Router();

const brandAssociationController = require('./brandAssociation.controller');
const { authenticate } = require('../../shared/identity');

router.post('/professional/brand/association', [authenticate], brandAssociationController.requestForAssociationWithBrand);
router.get('/professional/brand/association/list', [authenticate], brandAssociationController.getAllAssociationRequest);
router.post('/professional/brand/association/answer', [authenticate], brandAssociationController.answerAssociationRequest);
router.delete('/professional/brand/association/remove', [authenticate], brandAssociationController.deleteAssociation);
router.get('/professional/brand/association/success/list', [authenticate], brandAssociationController.getAllAssociationProviders);

module.exports = router;
