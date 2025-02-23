const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const orderController = require('../controllers/orderController');

// Admin routes should be before other routes to prevent conflicts
router.get('/admin/orders', auth, adminAuth, orderController.getAdminOrders);
router.put('/:id/status', auth, adminAuth, orderController.updateOrderStatus);

// Other routes
router.post('/', auth, orderController.createOrder);
router.get('/', auth, orderController.getOrders);
router.get('/:id', auth, orderController.getOrderById);
router.post('/:id/cancel', auth, orderController.cancelOrder);

module.exports = router; 