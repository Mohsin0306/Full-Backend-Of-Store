const mongoose = require('mongoose');

// Check if model already exists to prevent OverwriteModelError
const PushSubscription = mongoose.models.PushSubscription || mongoose.model('PushSubscription', new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subscription: {
    endpoint: String,
    keys: {
      p256dh: String,
      auth: String
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}));

module.exports = PushSubscription; 