const express = require('express');
const router = express.Router();

const addressController = require('./address.controller');
const { authenticate } = require('../identity/authenticate');

router.post('/addNewAddress',[authenticate], addressController.addNewAddress);
router.put('/editAddress/:id',[authenticate], addressController.editAddress);
router.get('/getAllUserAddress',[authenticate], addressController.getAllUserAddress);
router.get('/getAllBuinessAddress',[authenticate], addressController.getAllBusinessAddress);
router.get('/getBuinessAddressById/:id',addressController.getBusinessAddressById);
router.post('/deleteAddress/:id',[authenticate], addressController.deleteAddress);
router.get('/checkAddressProvided',[authenticate],  addressController.checkAddressProvided);

module.exports = router;
