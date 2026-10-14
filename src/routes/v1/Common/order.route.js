const express = require('express');
const router = express.Router();
const { requireAdmin, requireOwnerOrAdmin } = require('../../../middlewares/access.middleware');
const { OrderDetails } = require('../../../models');

const orderController = require('../../../controllers/Common/order.controller');
const userAuthMiddleware = require('../../../middlewares/userAuth.middleware');

router.post('/createOrder',[userAuthMiddleware.verifyAuthJWTToken], orderController.createOrder);
router.get('/getAllUserOrders',[userAuthMiddleware.verifyAuthJWTToken], orderController.getAllUserOrders);
router.post('/addNewAddress',[userAuthMiddleware.verifyAuthJWTToken], orderController.addNewAddress);
router.put('/editAddress/:id',[userAuthMiddleware.verifyAuthJWTToken], orderController.editAddress);
router.get('/getAllUserAddress',[userAuthMiddleware.verifyAuthJWTToken], orderController.getAllUserAddress);
router.get('/getAllBuinessAddress',[userAuthMiddleware.verifyAuthJWTToken], orderController.getAllBuinessAddress);
router.get('/getBuinessAddressById/:id',orderController.getBuinessAddressById);
router.post('/deleteAddress/:id',[userAuthMiddleware.verifyAuthJWTToken], orderController.deleteAddress);
router.post('/getAllProfessionalOrders', [userAuthMiddleware.verifyAuthJWTToken],orderController.getAllProfessionalOrders);
router.get('/checkAddressProvided',[userAuthMiddleware.verifyAuthJWTToken],  orderController.checkAddressProvided);

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