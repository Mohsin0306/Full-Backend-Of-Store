const mongoose = require('mongoose');
const Notification = require('./Notification');
const Buyer = require('./Buyer');

const cleanSubcategory = (sub) => {
  if (typeof sub !== 'string') return '';
  try {
    // Keep parsing until we get a clean string
    let parsed = sub;
    while (typeof parsed === 'string' && (parsed.startsWith('[') || parsed.startsWith('"'))) {
      parsed = JSON.parse(parsed);
    }
    return typeof parsed === 'string' ? parsed.trim() : '';
  } catch (e) {
    // If parsing fails, remove any brackets and quotes
    return sub.replace(/[\[\]"\\]/g, '').trim();
  }
};

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required']
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: 0
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Product category is required']
  },
  subcategories: {
    type: [String],
    required: [true, 'At least one subcategory is required']
  },
  brand: {
    type: String,
    required: [true, 'Brand name is required']
  },
  stock: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: 0,
    default: 0
  },
  media: [{
    type: {
      type: String,
      enum: ['image', 'video'],
      required: true
    },
    public_id: String,
    url: String,
    thumbnail: String // For video thumbnails
  }],
  specifications: [{
    key: String,
    value: String
  }],
  features: [String],
  ratings: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Buyer'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    review: String,
    date: {
      type: Date,
      default: Date.now
    }
  }],
  averageRating: {
    type: Number,
    default: 0
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'outOfStock'],
    default: 'draft'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  viewCount: {
    type: Number,
    default: 0
  },
  lastViewedAt: {
    type: Date,
    default: Date.now
  },
  orderCount: {
    type: Number,
    default: 0
  }
});

// Update timestamp on save
productSchema.pre('save', async function(next) {
  this.updatedAt = Date.now();
  
  if (this.isNew && this.status === 'published') {
    // Notify all users about new product
    try {
      const buyers = await Buyer.find().select('_id');
      const notification = {
        type: 'NEW_PRODUCT',
        title: 'New Product Available!',
        message: `Check out our new product: ${this.name}`,
        data: { productId: this._id }
      };
      
      await Notification.insertMany(
        buyers.map(buyer => ({
          ...notification,
          recipient: buyer._id
        }))
      );
    } catch (error) {
      console.error('Error creating new product notifications:', error);
    }
  } else if (this.isModified('price') && this.price < this._original.price) {
    // Only notify users about price drops
    try {
      const buyers = await Buyer.find().select('_id');
      const notification = {
        type: 'PRICE_DROP',
        title: 'Price Drop Alert!',
        message: `The price of ${this.name} has dropped from $${this._original.price} to $${this.price}`,
        data: {
          productId: this._id,
          oldPrice: this._original.price,
          newPrice: this.price
        }
      };
      
      await Notification.insertMany(
        buyers.map(buyer => ({
          ...notification,
          recipient: buyer._id
        }))
      );
    } catch (error) {
      console.error('Error creating price update notifications:', error);
    }
  }

  // Check for stock changes
  if (this.isModified('stock')) {
    try {
      const newStock = this.stock;
      const oldStock = this._original?.stock || 0;

      // Only notify if:
      // 1. Stock was 0 and now available
      // 2. Stock has dropped to 5 or less (but greater than 0)
      if ((oldStock === 0 && newStock > 0) || 
          (oldStock > 5 && newStock <= 5 && newStock > 0)) {
        
        const buyers = await Buyer.find().select('_id');
        const notification = {
          type: 'STOCK_UPDATE',
          title: oldStock === 0 ? 'Back in Stock!' : 'Low Stock Alert',
          message: oldStock === 0 
            ? `${this.name} is back in stock with ${newStock} units available!`
            : `Only ${newStock} units left of ${this.name}! Get it before it's gone.`,
          data: { 
            productId: this._id,
            newStock: newStock
          }
        };

        await Notification.insertMany(
          buyers.map(buyer => ({
            ...notification,
            recipient: buyer._id
          }))
        );
      }
    } catch (error) {
      console.error('Error creating stock update notifications:', error);
    }
  }
  
  // Clean subcategories
  if (Array.isArray(this.subcategories)) {
    this.subcategories = this.subcategories.map(sub => cleanSubcategory(sub)).filter(Boolean);
  }
  
  if (this.isModified('orderCount')) {
    console.log(`Product ${this._id} order count updated to ${this.orderCount}`);
  }
  
  next();
});

// Add these methods to the productSchema
productSchema.statics.incrementOrderCount = async function(productId, quantity = 1) {
  try {
    const product = await this.findByIdAndUpdate(
      productId,
      { 
        $inc: { orderCount: quantity },
        $set: { updatedAt: Date.now() }
      },
      { new: true }
    );
    console.log(`Incremented order count for product ${productId} by ${quantity}`);
    return product;
  } catch (error) {
    console.error(`Error incrementing order count for product ${productId}:`, error);
    throw error;
  }
};

productSchema.statics.getTopSelling = async function(limit = 10) {
  return this.find({
    status: 'published',
    stock: { $gt: 0 },
    orderCount: { $gt: 0 }
  })
  .sort({ orderCount: -1 })
  .limit(limit);
};

module.exports = mongoose.model('Product', productSchema); 