const express = require('express');
const router = express.Router();
const { singleUploadMiddleware } = require('../middleware/upload');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const {
  createBanner,
  getBanners,
  updateBanner,
  deleteBanner
} = require('../controllers/BannerController');

// Public route to get banners
router.get('/', getBanners);

// Admin routes
router.post('/', auth, adminAuth, singleUploadMiddleware, createBanner);
router.put('/:id', auth, adminAuth, singleUploadMiddleware, updateBanner);
router.delete('/:id', auth, adminAuth, deleteBanner);

module.exports = router;
