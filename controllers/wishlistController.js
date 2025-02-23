const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');

exports.getWishlist = async (req, res) => {
  try {
    let wishlist = await Wishlist.findOne({ buyer: req.user.id })
      .populate({
        path: 'products',
        select: 'name price media description brand stock status'
      });

    if (!wishlist) {
      wishlist = await Wishlist.create({
        buyer: req.user.id,
        products: []
      });
    }

    res.status(200).json({
      success: true,
      data: wishlist
    });
  } catch (error) {
    console.error('Error in getWishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching wishlist',
      error: error.message
    });
  }
};

exports.addToWishlist = async (req, res) => {
  try {
    const { productId } = req.body;

    // Validate product existence
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Find or create wishlist
    let wishlist = await Wishlist.findOne({ buyer: req.user.id });
    if (!wishlist) {
      wishlist = await Wishlist.create({
        buyer: req.user.id,
        products: []
      });
    }

    // Check if product already exists in wishlist
    if (wishlist.products.includes(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Product already in wishlist'
      });
    }

    // Add product to wishlist
    wishlist.products.push(productId);
    await wishlist.save();

    // Populate product details before sending response
    const updatedWishlist = await Wishlist.findById(wishlist._id)
      .populate({
        path: 'products',
        select: 'name price media description brand stock status'
      });

    res.status(200).json({
      success: true,
      message: 'Product added to wishlist',
      data: updatedWishlist
    });
  } catch (error) {
    console.error('Error in addToWishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding product to wishlist',
      error: error.message
    });
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    const { productId } = req.params;

    const wishlist = await Wishlist.findOne({ buyer: req.user.id });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    // Remove product from wishlist
    wishlist.products = wishlist.products.filter(
      product => product.toString() !== productId
    );
    await wishlist.save();

    // Populate product details before sending response
    const updatedWishlist = await Wishlist.findById(wishlist._id)
      .populate({
        path: 'products',
        select: 'name price media description brand stock status'
      });

    res.status(200).json({
      success: true,
      message: 'Product removed from wishlist',
      data: updatedWishlist
    });
  } catch (error) {
    console.error('Error in removeFromWishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing product from wishlist',
      error: error.message
    });
  }
};

exports.clearWishlist = async (req, res) => {
  try {
    const wishlist = await Wishlist.findOne({ buyer: req.user.id });
    if (!wishlist) {
      return res.status(404).json({
        success: false,
        message: 'Wishlist not found'
      });
    }

    wishlist.products = [];
    await wishlist.save();

    res.status(200).json({
      success: true,
      message: 'Wishlist cleared successfully',
      data: wishlist
    });
  } catch (error) {
    console.error('Error in clearWishlist:', error);
    res.status(500).json({
      success: false,
      message: 'Error clearing wishlist',
      error: error.message
    });
  }
}; 