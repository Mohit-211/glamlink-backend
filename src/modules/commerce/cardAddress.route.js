const express = require('express');
const router = express.Router();

const cardAddressController = require('./cardAddress.controller');

router.post('/addNewAddress-public', cardAddressController.addNewAddressPublic);
router.put('/editAddress-public/:id', cardAddressController.editAddressPublic);
router.get('/getAddressByBusinessCardId/:business_card_id', cardAddressController.getAddressByBusinessCardIdPublic);

module.exports = router;
