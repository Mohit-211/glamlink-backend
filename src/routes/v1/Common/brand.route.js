const express = require('express');
const router = express.Router();

const { brandController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

router.post('/createBrand', [userAuthMiddleware.verifyAuthJWTToken], brandController.createBrand);
router.get('/getAllBrands', [userAuthMiddleware.verifyAuthJWTToken], brandController.getAllBrands);
router.get('/getBrandById/:id', brandController.getBrandById);
router.get('/getBrandName',[userAuthMiddleware.verifyAuthJWTToken], brandController.getBrandName);
router.put('/updateBrand/:id', brandController.updateBrand);
router.post('/delete', brandController.deleteBrand);


module.exports = router;

