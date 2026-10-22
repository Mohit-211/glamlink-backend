const express = require('express');
const router = express.Router();
const catchAsync = require('../../core/http/catchAsync');
const httpStatus = require('../../core/http/status');
const responseWrapper = require('../../core/http/responseWrapper');
const { requireProfessional } = require('../../shared/identity');
const myProducts = require('./myProducts.service');

// The signed-in professional's or brand's own products
router.get('/', requireProfessional, catchAsync(async (req, res) => responseWrapper(res, await myProducts.listMine(req.user, req.query), '')));
router.post('/', requireProfessional, catchAsync(async (req, res) => responseWrapper(res, await myProducts.createMine(req.user, req.body, req.files), 'Product added.', httpStatus.CREATED)));
router.put('/:id', requireProfessional, catchAsync(async (req, res) => responseWrapper(res, await myProducts.updateMine(req.user, req.params.id, req.body, req.files), 'Product saved.')));
router.delete('/:id', requireProfessional, catchAsync(async (req, res) => responseWrapper(res, await myProducts.deleteMine(req.user, req.params.id), 'Product deleted.')));

module.exports = router;
