const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../../middlewares/access.middleware');

const brandController = require('../../../controllers/Common/brand.controller');
const userAuthMiddleware = require('../../../middlewares/userAuth.middleware');

router.post('/createBrand', [userAuthMiddleware.verifyAuthJWTToken], brandController.createBrand);
router.get('/getAllBrands', [userAuthMiddleware.verifyAuthJWTToken], brandController.getAllBrands);
router.get('/getBrandById/:id', requireAdmin, brandController.getBrandById);
router.get('/getBrandName',[userAuthMiddleware.verifyAuthJWTToken], brandController.getBrandName);
router.put('/updateBrand/:id', requireAdmin, brandController.updateBrand);
router.post('/delete', requireAdmin, brandController.deleteBrand);


module.exports = router;

