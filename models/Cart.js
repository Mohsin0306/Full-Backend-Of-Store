const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true
  },
  selectedOptions: {
    // For any product-specific options (e.g., size, color)
    type: Map,
    of: String,
    default: new Map()
  }
});

const cartSchema = new mongoose.Schema({
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Buyer',
    required: true
  },
  items: [cartItemSchema],
  totalAmount: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update total amount before saving
cartSchema.pre('save', async function(next) {
  this.totalAmount = this.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('Cart', cartSchema); 