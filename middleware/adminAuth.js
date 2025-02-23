const Seller = require('../models/Seller');

const adminAuth = async (req, res, next) => {
  try {
    const seller = await Seller.findById(req.user.id);
    
    if (!seller || !seller.isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }
    
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error verifying admin privileges',
      error: error.message
    });
  }
};

module.exports = adminAuth; 