const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: {
    type: String,
    required: true
  },
  image: {
    public_id: String,
    url: String
  },
  icon: {
    type: String,
    default: 'RiFlowerLine'
  },
  color: {
    type: String,
    default: 'from-pink-400 to-rose-500'
  },
  bgPattern: {
    type: String,
    default: 'bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-from),transparent_70%)]'
  },
  subcategories: [{
    type: String
  }],
  featured: [{
    type: String
  }],
  items: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Category', categorySchema);