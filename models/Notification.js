const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Buyer',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Buyer'
  },
  type: {
    type: String,
    enum: [
      'NEW_PRODUCT',
      'PRODUCT_UPDATE',
      'PRICE_UPDATE',
      'STOCK_UPDATE',
      'ORDER_STATUS',
      'NEW_ORDER',
      'ADMIN_MESSAGE',
      'PRICE_DROP',
      'ORDER_CANCELLED'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  hidden: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ isRead: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ hidden: 1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;