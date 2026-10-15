const express = require('express');
const router = express.Router();
const { requireAdmin, requireOwnerOrAdmin } = require('../../core/auth/access.middleware');
const { OrderDetails } = require('../../models');

const orderController = require('./order.controller');
const { authenticate } = require('../../core/auth/authenticate');

router.get('/getAllUserOrders',[authenticate], orderController.getAllUserOrders);
router.post('/getAllProfessionalOrders', [authenticate],orderController.getAllProfessionalOrders);
//ADMIN API
router.get('/getAllOrders', requireAdmin, orderController.getAllOrders);
router.get('/getOrderById/:id', requireAdmin, orderController.getOrderById);
router.post('/updateOrderStatus/:id', requireAdmin, orderController.updateOrderStatus);
router.get('/getShipmentStatus/:id', requireOwnerOrAdmin({ model: OrderDetails, ownerField: 'professional_id', getIds: (req) => req.params.id }), orderController.getShipmentStatus);
router.post('/createShipmentLabel/:id', requireOwnerOrAdmin({ model: OrderDetails, ownerField: 'professional_id', getIds: (req) => req.params.id }), orderController.createShipmentLabel);

module.exports = router;
