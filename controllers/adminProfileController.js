const Seller = require('../models/Seller');
const validateAdminProfileUpdate = require('../validation/adminProfileValidation');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary.config');
const catchAsync = require('../utils/catchAsync');

// Get admin profile
exports.getAdminProfile = catchAsync(async (req, res) => {
  const admin = await Seller.findById(req.user.id).select('-password');
  
  if (!admin) {
    return res.status(404).json({
      success: false,
      message: 'Admin profile not found'
    });
  }

  res.status(200).json({
    success: true,
    data: admin
  });
});

// Update admin profile
exports.updateAdminProfile = catchAsync(async (req, res) => {
  // Validate request body
  const { error } = validateAdminProfileUpdate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message
    });
  }

  const admin = await Seller.findById(req.user.id);
  if (!admin) {
    return res.status(404).json({
      success: false,
      message: 'Admin profile not found'
    });
  }

  // Update fields
  const updateFields = {
    ...req.body,
    lastUpdated: Date.now()
  };

  const updatedAdmin = await Seller.findByIdAndUpdate(
    req.user.id,
    { $set: updateFields },
    { new: true, runValidators: true }
  ).select('-password');

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: updatedAdmin
  });
});

// Update admin profile picture
exports.updateProfilePicture = catchAsync(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Please upload a file'
    });
  }

  const admin = await Seller.findById(req.user.id);
  if (!admin) {
    return res.status(404).json({
      success: false,
      message: 'Admin profile not found'
    });
  }

  // Delete old profile picture if exists
  if (admin.profilePicture?.public_id) {
    await deleteFromCloudinary(admin.profilePicture.public_id);
  }

  // Upload new profile picture
  const result = await uploadToCloudinary(req.file);

  // Update admin profile with new picture
  const updatedAdmin = await Seller.findByIdAndUpdate(
    req.user.id,
    {
      $set: {
        profilePicture: {
          public_id: result.public_id,
          url: result.url
        },
        lastUpdated: Date.now()
      }
    },
    { new: true, runValidators: true }
  ).select('-password');

  res.status(200).json({
    success: true,
    message: 'Profile picture updated successfully',
    data: updatedAdmin
  });
});

// Delete profile picture
exports.deleteProfilePicture = catchAsync(async (req, res) => {
  const admin = await Seller.findById(req.user.id);
  if (!admin) {
    return res.status(404).json({
      success: false,
      message: 'Admin profile not found'
    });
  }

  if (admin.profilePicture?.public_id) {
    await deleteFromCloudinary(admin.profilePicture.public_id);
  }

  const updatedAdmin = await Seller.findByIdAndUpdate(
    req.user.id,
    {
      $set: {
        profilePicture: { public_id: '', url: '' },
        lastUpdated: Date.now()
      }
    },
    { new: true, runValidators: true }
  ).select('-password');

  res.status(200).json({
    success: true,
    message: 'Profile picture removed successfully',
    data: updatedAdmin
  });
});

// Add new controller method for public info
exports.getAdminPublicInfo = catchAsync(async (req, res) => {
  // Find the admin (we know there's only one with isAdmin true)
  const admin = await Seller.findOne({ isAdmin: true })
    .select('businessDetails.companyName profilePicture');
  
  if (!admin) {
    return res.status(404).json({
      success: false,
      message: 'Admin profile not found'
    });
  }

  res.status(200).json({
    success: true,
    data: {
      businessName: admin.businessDetails.companyName || 'Admin Store',
      profilePicture: admin.profilePicture
    }
  });
}); 