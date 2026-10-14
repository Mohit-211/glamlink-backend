const express = require('express');
const shippoController = require('../../../controllers/Common/shippo.controller');

const router = express.Router();


router.post('/webhook', express.raw({type: 'application/json'}), shippoController.handleShippoWebhook);


module.exports = router;