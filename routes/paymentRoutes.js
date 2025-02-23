const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

router.post('/jazzcash/init', auth, paymentController.initializeJazzCashPayment);
router.post('/easypaisa/init', auth, paymentController.initializeEasyPaisaPayment);

module.exports = router; 