const mongoose = require('mongoose');

const wishlistSchema = new mongoose.Schema({
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Buyer',
    required: true
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update lastUpdated timestamp before saving
wishlistSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('Wishlist', wishlistSchema); 