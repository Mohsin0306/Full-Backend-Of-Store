const express = require('express');
const router = express.Router();
const { 
  getBuyerProfile, 
  updateBuyerProfile,
  deleteBuyerProfilePicture,
  getAllBuyers,
  getBuyerDetails,
  getBuyerStats,
  deleteBuyerAccount
} = require('../controllers/buyerController');
const auth = require('../middleware/auth');
const { singleUploadMiddleware } = require('../middleware/upload');

// Get buyer profile
router.get('/profile', auth, getBuyerProfile);

// Update buyer profile
router.put('/profile', auth, singleUploadMiddleware, updateBuyerProfile);

// Delete profile picture
router.delete('/profile/picture', auth, deleteBuyerProfilePicture);

// All routes require authentication
router.use(auth);

// Get all buyers (admin only)
router.get('/', getAllBuyers);

// Get single buyer details (admin only)
router.get('/:id', getBuyerDetails);

// Get buyer statistics (admin only)
router.get('/stats/overview', getBuyerStats);

// Delete buyer account
router.delete('/delete-account', auth, deleteBuyerAccount);

module.exports = router; 