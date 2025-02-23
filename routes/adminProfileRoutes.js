const express = require('express');
const router = express.Router();
const multer = require('multer');
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const {
  getAdminProfile,
  updateAdminProfile,
  updateProfilePicture,
  deleteProfilePicture,
  getAdminPublicInfo
} = require('../controllers/adminProfileController');

// Multer configuration for file upload
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image.'), false);
    }
  }
});

// Routes
router.get('/profile', auth, adminAuth, getAdminProfile);
router.put('/profile', auth, adminAuth, updateAdminProfile);
router.put('/profile/picture', auth, adminAuth, upload.single('profilePicture'), updateProfilePicture);
router.delete('/profile/picture', auth, adminAuth, deleteProfilePicture);
router.get('/profile/public-info', getAdminPublicInfo);

module.exports = router; 