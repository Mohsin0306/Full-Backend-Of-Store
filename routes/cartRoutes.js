const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart
} = require('../controllers/cartController');

// All routes are protected with auth middleware
router.use(auth);

// Cart routes
router.post('/add', addToCart);
router.get('/', getCart);
router.put('/update', updateCartItem);
router.delete('/remove/:productId', removeFromCart);
router.delete('/clear', clearCart);

module.exports = router; 