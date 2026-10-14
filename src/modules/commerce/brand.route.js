const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../core/auth/access.middleware');

const brandController = require('./brand.controller');
const userAuthMiddleware = require('../../core/auth/userAuth.middleware');

router.post('/createBrand', [userAuthMiddleware.verifyAuthJWTToken], brandController.createBrand);
router.get('/getAllBrands', [userAuthMiddleware.verifyAuthJWTToken], brandController.getAllBrands);
router.get('/getBrandById/:id', requireAdmin, brandController.getBrandById);
router.get('/getBrandName',[userAuthMiddleware.verifyAuthJWTToken], brandController.getBrandName);
router.put('/updateBrand/:id', requireAdmin, brandController.updateBrand);
router.post('/delete', requireAdmin, brandController.deleteBrand);


module.exports = router;

