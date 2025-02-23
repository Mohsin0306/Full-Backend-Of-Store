const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { uploadMiddleware } = require('../middleware/upload');
const {
  createProduct,
  updateProduct,
  getProducts,
  getProductById,
  deleteProduct,
  getProductsByCategory,
  searchProducts,
  getSearchSuggestions
} = require('../controllers/productController');

// Specific routes first
router.get('/search', searchProducts);
router.get('/suggestions', getSearchSuggestions);
router.get('/category/:categoryId', getProductsByCategory);

// Then dynamic routes
router.post('/', auth, uploadMiddleware, createProduct);
router.put('/:id', auth, uploadMiddleware, updateProduct);
router.get('/', getProducts);
router.get('/:id', getProductById);
router.delete('/:id', auth, deleteProduct);

module.exports = router; 