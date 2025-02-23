const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist
} = require('../controllers/wishlistController');

// All routes are protected with auth middleware
router.use(auth);

// Wishlist routes
router.get('/', getWishlist);
router.post('/add', addToWishlist);
router.delete('/remove/:productId', removeFromWishlist);
router.delete('/clear', clearWishlist);

module.exports = router; 