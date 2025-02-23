const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { singleUploadMiddleware } = require('../middleware/upload');
const {
  createCategory,
  updateCategory,
  deleteCategory,
  getCategories,
  getCategory
} = require('../controllers/categoryController');

// Get all categories
router.get('/', getCategories);

// Create category - requires auth and image upload
router.post('/', auth, singleUploadMiddleware, createCategory);

// Update category
router.put('/:id', auth, singleUploadMiddleware, updateCategory);

// Delete category
router.delete('/:id', auth, deleteCategory);

// Get single category
router.get('/:id', getCategory);

module.exports = router;