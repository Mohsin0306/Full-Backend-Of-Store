const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'participantModel',
    required: true
  }],
  participantModel: {
    type: String,
    required: true,
    enum: ['Buyer', 'Seller']
  },
  lastMessage: {
    type: String,
    default: ''
  },
  lastMessageTime: {
    type: Date,
    default: Date.now
  },
  unreadCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Add indexes for better query performance
chatSchema.index({ participants: 1 });
chatSchema.index({ participantModel: 1 });

const Chat = mongoose.model('Chat', chatSchema);

module.exports = Chat;
