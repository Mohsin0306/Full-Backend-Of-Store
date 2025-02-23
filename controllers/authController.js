const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Buyer = require('../models/Buyer');
const Seller = require('../models/Seller');

// Buyer Registration
exports.registerBuyer = async (req, res) => {
  try {
    const { 
      username,
      name, 
      phoneNumber
    } = req.body;

    // Check if buyer exists by username or phone only
    let buyerExists = await Buyer.findOne({ 
      $or: [
        { username },
        { phoneNumber }
      ]
    });
    
    if (buyerExists) {
      return res.status(400).json({ 
        success: false,
        message: buyerExists.phoneNumber === phoneNumber ? 
          'Phone number already registered' : 
          'Username already taken'
      });
    }

    // Create new buyer with only required fields
    const buyer = new Buyer({
      username,
      name,
      phoneNumber,
      role: 'user'
    });

    // Save buyer
    await buyer.save();

    // Create token
    const token = jwt.sign(
      { 
        id: buyer._id, 
        type: 'buyer',
        username: buyer.username,
        role: 'user'
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({ 
      success: true,
      token,
      user: {
        id: buyer._id,
        username: buyer.username,
        name: buyer.name,
        phoneNumber: buyer.phoneNumber,
        role: 'user'
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Registration failed'
    });
  }
};

// Login with phone number only
exports.login = async (req, res) => {
  try {
    const { phoneNumber } = req.body; 

    let user = await Seller.findOne({ phoneNumber });

    if (!user) {
      user = await Buyer.findOne({ phoneNumber });
    }

    // If no user found
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'No account found with this phone number'
      });
    }

    // Create token
    const token = jwt.sign(
      { 
        id: user._id,
        type: user.isAdmin ? 'seller' : 'buyer',
        username: user.username,
        isAdmin: user.isAdmin || false
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Send response
    res.json({
      success: true,
      token,
      user: {
        _id: user._id,
        username: user.username,
        name: user.name,
        phoneNumber: user.phoneNumber,
        role: user.isAdmin ? 'seller' : 'buyer',
        isAdmin: user.isAdmin || false
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}; 