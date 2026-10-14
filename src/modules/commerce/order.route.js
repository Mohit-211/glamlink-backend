const express = require('express');
const router = express.Router();
const { requireAdmin, requireOwnerOrAdmin } = require('../../core/auth/access.middleware');
const { OrderDetails } = require('../../models');

const orderController = require('./order.controller');
const { authenticate } = require('../../core/auth/authenticate');

router.get('/getAllUserOrders',[authenticate], orderController.getAllUserOrders);
router.post('/addNewAddress',[authenticate], orderController.addNewAddress);
router.put('/editAddress/:id',[authenticate], orderController.editAddress);
router.get('/getAllUserAddress',[authenticate], orderController.getAllUserAddress);
router.get('/getAllBuinessAddress',[authenticate], orderController.getAllBuinessAddress);
router.get('/getBuinessAddressById/:id',orderController.getBuinessAddressById);
router.post('/deleteAddress/:id',[authenticate], orderController.deleteAddress);
router.post('/getAllProfessionalOrders', [authenticate],orderController.getAllProfessionalOrders);
router.get('/checkAddressProvided',[authenticate],  orderController.checkAddressProvided);

//ADMIN API
router.get('/getAllOrders', requireAdmin, orderController.getAllOrders);
router.get('/getOrderById/:id', requireAdmin, orderController.getOrderById);
router.post('/updateOrderStatus/:id', requireAdmin, orderController.updateOrderStatus);
router.get('/getShipmentStatus/:id', requireOwnerOrAdmin({ model: OrderDetails, ownerField: 'professional_id', getIds: (req) => req.params.id }), orderController.getShipmentStatus);
router.post('/createShipmentLabel/:id', requireOwnerOrAdmin({ model: OrderDetails, ownerField: 'professional_id', getIds: (req) => req.params.id }), orderController.createShipmentLabel);


router.post('/addNewAddress-public', orderController.addNewAddressPublic);
router.put('/editAddress-public/:id', orderController.editAddressPublic);
router.get('/getAddressByBusinessCardId/:business_card_id', orderController.getAddressByBusinessCardIdPublic);


module.exports = router;