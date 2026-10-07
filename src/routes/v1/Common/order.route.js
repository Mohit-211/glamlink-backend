const express = require('express');
const router = express.Router();

const { orderController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

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
router.get('/getAllOrders', orderController.getAllOrders);
router.get('/getOrderById/:id', orderController.getOrderById);
router.post('/updateOrderStatus/:id', orderController.updateOrderStatus);
router.get('/getShipmentStatus/:id', orderController.getShipmentStatus);
router.post('/createShipmentLabel/:id', orderController.createShipmentLabel);


router.post('/addNewAddress-public', orderController.addNewAddressPublic);
router.put('/editAddress-public/:id', orderController.editAddressPublic);
router.get('/getAddressByBusinessCardId/:business_card_id', orderController.getAddressByBusinessCardIdPublic);


module.exports = router;