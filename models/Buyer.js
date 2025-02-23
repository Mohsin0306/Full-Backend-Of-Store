const mongoose = require('mongoose');

const buyerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: false
  },
  country: {
    type: String,
    trim: true,
    required: false
  },
  city: {
    type: String,
    trim: true,
    required: false
  },
  address: {
    type: String,
    trim: true,
    required: false
  },
  gender: {
    type: String,
    required: false,
    enum: ['male', 'female', 'other', 'not_specified'],
    default: 'not_specified'
  },
  dateOfBirth: {
    type: Date,
    required: false
  },
  firstName: {
    type: String,
    trim: true,
    required: false
  },
  lastName: {
    type: String,
    trim: true,
    required: false
  },
  profilePicture: {
    public_id: String,
    url: String
  },
  preferredScents: [{
    type: String,
    trim: true
  }],
  allergies: [{
    type: String,
    trim: true
  }],
  bio: {
    type: String,
    trim: true,
    maxLength: 500
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  notificationPreferences: {
    orderUpdates: { type: Boolean, default: true },
    promotions: { type: Boolean, default: false },
    priceAlerts: { type: Boolean, default: true }
  }
}, {
  timestamps: true
});

// Drop any existing indexes related to email
buyerSchema.pre('save', async function(next) {
  try {
    await this.collection.dropIndexes({ 'email': 1 });
  } catch (error) {
    // Ignore error if index doesn't exist
  }
  next();
});

module.exports = mongoose.model('Buyer', buyerSchema);