const Cart = require('../models/Cart');
const Product = require('../models/Product');

exports.addToCart = async (req, res) => {
  try {
    const { productId, quantity = 1, options = {} } = req.body;
    const buyerId = req.user.id;

    // Validate product existence and stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock'
      });
    }

    // Find or create cart for user
    let cart = await Cart.findOne({ buyer: buyerId });
    if (!cart) {
      cart = new Cart({ buyer: buyerId, items: [] });
    }

    // Check if product already exists in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (existingItemIndex > -1) {
      // Update quantity if product exists
      cart.items[existingItemIndex].quantity += quantity;
    } else {
      // Add new item if product doesn't exist
      cart.items.push({
        product: productId,
        quantity,
        price: product.price,
        selectedOptions: options
      });
    }

    await cart.save();
    
    // Populate product details
    await cart.populate('items.product', 'name media price');

    res.json({
      success: true,
      cart
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error adding item to cart',
      error: error.message
    });
  }
};

exports.getCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ buyer: req.user.id })
      .populate('items.product', 'name media price stock');

    res.json({
      success: true,
      cart: cart || { items: [], totalAmount: 0 }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching cart',
      error: error.message
    });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    
    if (quantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be at least 1'
      });
    }

    const cart = await Cart.findOne({ buyer: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in cart'
      });
    }

    // Check stock availability
    const product = await Product.findById(productId);
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock'
      });
    }

    cart.items[itemIndex].quantity = quantity;
    await cart.save();
    await cart.populate('items.product', 'name media price stock');

    res.json({
      success: true,
      cart
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating cart item',
      error: error.message
    });
  }
};

exports.removeFromCart = async (req, res) => {
  try {
    const { productId } = req.params;
    
    const cart = await Cart.findOne({ buyer: req.user.id });
    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Cart not found'
      });
    }

    cart.items = cart.items.filter(
      item => item.product.toString() !== productId
    );

    await cart.save();
    await cart.populate('items.product', 'name media price stock');

    res.json({
      success: true,
      cart
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error removing item from cart',
      error: error.message
    });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOne({ buyer: req.user.id });
    if (cart) {
      cart.items = [];
      await cart.save();
    }

    res.json({
      success: true,
      message: 'Cart cleared successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error clearing cart',
      error: error.message
    });
  }
}; 