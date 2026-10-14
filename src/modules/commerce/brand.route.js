const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../core/auth/access.middleware');

const brandController = require('./brand.controller');
const { authenticate } = require('../../core/auth/authenticate');

router.post('/createBrand', [authenticate], brandController.createBrand);
router.get('/getAllBrands', [authenticate], brandController.getAllBrands);
router.get('/getBrandById/:id', requireAdmin, brandController.getBrandById);
router.get('/getBrandName',[authenticate], brandController.getBrandName);
router.put('/updateBrand/:id', requireAdmin, brandController.updateBrand);
router.post('/delete', requireAdmin, brandController.deleteBrand);


module.exports = router;

