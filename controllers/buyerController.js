const Buyer = require('../models/Buyer');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary.config');
const validateProfileUpdate = require('../validation/profileValidation');
const Seller = require('../models/Seller');
const Cart = require('../models/Cart');
const Wishlist = require('../models/Wishlist');
const Order = require('../models/Order');
const bcrypt = require('bcryptjs');

exports.getBuyerProfile = async (req, res) => {
  try {
    const buyer = await Buyer.findById(req.user.id).select('-password');
    
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    res.json({
      success: true,
      buyer
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateBuyerProfile = async (req, res) => {
  try {
    // Convert string inputs to arrays if needed
    if (req.body.preferredScents && typeof req.body.preferredScents === 'string') {
      req.body.preferredScents = req.body.preferredScents.split(',').map(scent => scent.trim());
    }
    if (req.body.allergies && typeof req.body.allergies === 'string') {
      req.body.allergies = req.body.allergies.split(',').map(allergy => allergy.trim());
    }

    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      address,
      city,
      country,
      gender,
      dateOfBirth,
      preferredScents,
      allergies,
      bio
    } = req.body;

    // Find buyer
    let buyer = await Buyer.findById(req.user.id);
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    // Check if email is being updated and if it's already in use
    if (email && email !== buyer.email) {
      const emailExists = await Buyer.findOne({ email });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
    }

    // Handle profile picture upload
    if (req.file) {
      try {
        // Delete old image if exists
        if (buyer.profilePicture?.public_id) {
          await deleteFromCloudinary(buyer.profilePicture.public_id);
        }

        // Upload new image
        const uploadResult = await uploadToCloudinary(req.file);
        if (!uploadResult) {
          return res.status(400).json({
            success: false,
            message: 'Error uploading profile picture. Please try again.'
          });
        }
        buyer.profilePicture = uploadResult;
      } catch (uploadError) {
        console.error('Profile picture upload error:', uploadError);
        return res.status(400).json({
          success: false,
          message: 'Error uploading profile picture. Please try again.'
        });
      }
    }

    // Update all possible fields
    if (firstName !== undefined) buyer.firstName = firstName;
    if (lastName !== undefined) buyer.lastName = lastName;
    if (email !== undefined) buyer.email = email;
    if (phoneNumber !== undefined) buyer.phoneNumber = phoneNumber;
    if (address !== undefined) buyer.address = address;
    if (city !== undefined) buyer.city = city;
    if (country !== undefined) buyer.country = country;
    if (gender !== undefined) buyer.gender = gender;
    if (dateOfBirth !== undefined) buyer.dateOfBirth = dateOfBirth;
    if (preferredScents !== undefined) buyer.preferredScents = preferredScents;
    if (allergies !== undefined) buyer.allergies = allergies;
    if (bio !== undefined) buyer.bio = bio;
    
    buyer.lastUpdated = Date.now();

    await buyer.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      buyer: {
        ...buyer.toObject(),
        password: undefined
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating profile. Please try again.'
    });
  }
};

exports.deleteBuyerProfilePicture = async (req, res) => {
  try {
    const buyer = await Buyer.findById(req.user.id);
    
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    if (buyer.profilePicture?.public_id) {
      // Delete image from Cloudinary
      await deleteFromCloudinary(buyer.profilePicture.public_id);
      
      // Remove profile picture from buyer document
      buyer.profilePicture = undefined;
      await buyer.save();
    }

    res.json({
      success: true,
      message: 'Profile picture removed successfully'
    });

  } catch (error) {
    console.error('Profile picture deletion error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting profile picture. Please try again.'
    });
  }
};

// Get all buyers for admin/seller
exports.getAllBuyers = async (req, res) => {
  try {
    // Check if the requester is an admin/seller
    const seller = await Seller.findById(req.user.id);
    if (!seller || !seller.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admins can view all buyers'
      });
    }

    // Get all buyers with selected fields
    const buyers = await Buyer.find({}, {
      password: 0, // Exclude password
      __v: 0 // Exclude version key
    }).sort({ createdAt: -1 }); // Sort by newest first

    // Add additional stats
    const stats = {
      total: buyers.length,
      activeThisMonth: buyers.filter(buyer => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return new Date(buyer.lastUpdated) > thirtyDaysAgo;
      }).length
    };

    res.status(200).json({
      success: true,
      data: {
        buyers,
        stats
      }
    });
  } catch (error) {
    console.error('Error in getAllBuyers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching buyers',
      error: error.message
    });
  }
};

// Get single buyer details with related data
exports.getBuyerDetails = async (req, res) => {
  try {
    // Check admin privileges
    const seller = await Seller.findById(req.user.id);
    if (!seller || !seller.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admins can view buyer details'
      });
    }

    // Get buyer details
    const buyer = await Buyer.findById(req.params.id).select('-password');
    if (!buyer) {
      return res.status(404).json({ success: false, message: 'Buyer not found' });
    }

    // Get related data
    const [cart, wishlist, orders] = await Promise.all([
      Cart.findOne({ buyer: req.params.id }).populate('items.product'),
      Wishlist.findOne({ buyer: req.params.id }).populate('products'),
      Order.find({ buyer: req.params.id }).sort({ createdAt: -1 })
    ]);

    res.status(200).json({
      success: true,
      data: {
        buyer,
        cart,
        wishlist,
        orders,
        stats: {
          totalOrders: orders.length,
          totalSpent: orders.reduce((sum, order) => sum + order.totalAmount, 0),
          averageOrderValue: orders.length ? 
            orders.reduce((sum, order) => sum + order.totalAmount, 0) / orders.length : 0,
          cartValue: cart?.totalAmount || 0,
          wishlistCount: wishlist?.products?.length || 0
        }
      }
    });
  } catch (error) {
    console.error('Error in getBuyerDetails:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching buyer details',
      error: error.message
    });
  }
};

// Get buyer statistics
exports.getBuyerStats = async (req, res) => {
  try {
    // Check if the requester is an admin/seller
    const seller = await Seller.findById(req.user.id);
    if (!seller || !seller.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admins can view statistics'
      });
    }

    const totalBuyers = await Buyer.countDocuments();
    
    // Get new buyers in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newBuyers = await Buyer.countDocuments({
      createdAt: { $gte: thirtyDaysAgo }
    });

    // Get gender distribution
    const genderStats = await Buyer.aggregate([
      {
        $group: {
          _id: '$gender',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get age distribution
    const ageStats = await Buyer.aggregate([
      {
        $project: {
          age: {
            $floor: {
              $divide: [
                { $subtract: [new Date(), '$dateOfBirth'] },
                365 * 24 * 60 * 60 * 1000
              ]
            }
          }
        }
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lte: ['$age', 18] }, then: '18 or younger' },
                { case: { $lte: ['$age', 24] }, then: '19-24' },
                { case: { $lte: ['$age', 34] }, then: '25-34' },
                { case: { $lte: ['$age', 44] }, then: '35-44' },
                { case: { $lte: ['$age', 54] }, then: '45-54' }
              ],
              default: '55+'
            }
          },
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalBuyers,
        newBuyers,
        genderStats,
        ageStats
      }
    });
  } catch (error) {
    console.error('Error in getBuyerStats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching buyer statistics',
      error: error.message
    });
  }
};

exports.deleteBuyerAccount = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const buyer = await Buyer.findById(req.user.id);

    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    // Verify phone number matches
    if (buyer.phoneNumber !== phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Phone number does not match'
      });
    }

    // Delete related data (cart, wishlist, orders, etc.)
    await Promise.all([
      Cart.deleteMany({ buyer: buyer._id }),
      Wishlist.deleteMany({ buyer: buyer._id }),
      Order.deleteMany({ buyer: buyer._id })
    ]);

    // Delete profile picture from cloudinary if exists
    if (buyer.profilePicture?.public_id) {
      await deleteFromCloudinary(buyer.profilePicture.public_id);
    }

    // Delete the buyer account
    await buyer.deleteOne();

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting account. Please try again.'
    });
  }
}; 