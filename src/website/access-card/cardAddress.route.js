const express = require('express');
const router = express.Router();

const cardAddressController = require('./cardAddress.controller');
const { requireCardAccess } = require('./cardAccess.middleware');

// The logged-out purchase addresses: the buyer proves it is their card with its card token (cardToken.js).

router.post('/addNewAddress-public', requireCardAccess((req) => req.body.business_card_id), cardAddressController.addNewAddressPublic);
router.put('/editAddress-public/:id', requireCardAccess((req) => req.body.business_card_id), cardAddressController.editAddressPublic);
router.get('/getAddressByBusinessCardId/:business_card_id', requireCardAccess((req) => req.params.business_card_id), cardAddressController.getAddressByBusinessCardIdPublic);

module.exports = router;
