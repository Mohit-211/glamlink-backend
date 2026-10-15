const express = require('express');
const router = express.Router();

const guestController = require('./guest.controller');

router.post('/continueAsGuest' , guestController.continueAsGuest);


module.exports = router;