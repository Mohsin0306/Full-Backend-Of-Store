const mongoose = require('mongoose');

const sellerSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    default: 'admin'
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  phoneNumber: {
    type: String,
    required: true
  },
  isAdmin: {
    type: Boolean,
    default: true
  },
  profilePicture: {
    public_id: String,
    url: String
  },
  bio: {
    type: String,
    trim: true,
    maxLength: 500
  },
  socialLinks: {
    facebook: String,
    twitter: String,
    instagram: String,
    linkedin: String
  },
  businessDetails: {
    companyName: String,
    businessAddress: String,
    businessPhone: String,
    businessEmail: String
  },
  buyers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Buyer'
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Seller', sellerSchema); 