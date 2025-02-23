const mongoose = require('mongoose');
const Product = require('./Product');
const Notification = require('./Notification');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true,
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Buyer',
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true
    }
  }],
  shippingAddress: {
    firstName: String,
    lastName: String,
    address: String,
    city: String,
    country: String,
    phoneNumber: String
  },
  paymentMethod: {
    type: String,
    enum: ['jazzcash', 'easypaisa', 'cod'],
    required: true
  },
  paymentDetails: {
    transactionId: String,
    phoneNumber: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending'
    }
  },
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  cancelReason: {
    type: String,
    enum: [
      'Location not serviceable',
      'Out of stock',
      'Customer requested cancellation',
      'Delivery issues',
      'Payment issues',
      'Other'
    ]
  }
});

// Add this pre-save middleware to update product orderCount
orderSchema.pre('save', async function(next) {
  // Only increment order counts for new orders
  if (this.isNew) {
    try {
      // Increment orderCount for each product in the order
      const updatePromises = this.items.map(item => 
        Product.findByIdAndUpdate(
          item.product,
          { $inc: { orderCount: item.quantity } },
          { new: true }
        )
      );
      
      await Promise.all(updatePromises);
      
      // Log for debugging
      console.log(`Updated order counts for products in order ${this.orderId}`);
    } catch (error) {
      console.error('Error updating product order counts:', error);
    }
  }

  // Continue with the existing orderId generation logic
  if (!this.orderId) {
    const date = new Date();
    const dateStr = date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    
    const lastOrder = await this.constructor.findOne({
      orderId: new RegExp(`ORD-${dateStr}-`, 'i')
    }).sort({ orderId: -1 });

    let sequence = '0001';
    if (lastOrder) {
      const lastSequence = parseInt(lastOrder.orderId.slice(-4));
      sequence = (lastSequence + 1).toString().padStart(4, '0');
    }

    this.orderId = `ORD-${dateStr}-${sequence}`;
  }
  
  this.updatedAt = Date.now();

  try {
    if (this.isModified('status') && this.status === 'cancelled') {
      // Find the buyer name
      const buyer = await mongoose.model('Buyer').findById(this.buyer);
      
      // Import at the top of the file
      const { createOrderCancellationNotification } = require('../controllers/notificationController');
      
      await createOrderCancellationNotification(this, buyer.name);
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Add this post-save hook for logging
orderSchema.post('save', function(doc) {
  console.log(`Order saved: ${doc.orderId}`);
  console.log('Products ordered:', doc.items.map(item => ({
    productId: item.product,
    quantity: item.quantity
  })));
});

// Add this to handle order cancellations
orderSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate();
  
  if (update.status) {
    const order = await this.model.findOne(this.getQuery());
    
    // Create status update notification
    try {
      const statusMessages = {
        processing: 'Your order is being processed',
        shipped: 'Your order has been shipped',
        delivered: 'Your order has been delivered',
        cancelled: 'Your order has been cancelled'
      };
      
      await Notification.create({
        recipient: order.buyer,
        type: 'ORDER_STATUS',
        title: 'Order Status Updated',
        message: statusMessages[update.status] || `Order status changed to ${update.status}`,
        data: {
          orderId: order._id,
          orderStatus: update.status
        }
      });
    } catch (error) {
      console.error('Error creating order status notification:', error);
    }
  }
  
  next();
});

module.exports = mongoose.model('Order', orderSchema); 