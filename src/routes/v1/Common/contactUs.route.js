const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../../../middlewares/access.middleware');

const { contactUsController } = require('../../../controllers');

router.post('/', contactUsController.createContactUs);
router.put('/:id', requireAdmin, contactUsController.updateContactUs);
router.get('/', requireAdmin, contactUsController.getAllContactUs);
router.get('/all', requireAdmin, contactUsController.getAllContactUsForAdmin);
router.delete('/:id', requireAdmin, contactUsController.deleteContactUs);


module.exports = router;