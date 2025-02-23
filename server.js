const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const connectDB = require('./config/db');
const fs = require('fs');
const path = require('path');
require('dotenv').config();
const http = require('http');
const { initializeSocket } = require('./services/socketService');
const webpush = require('web-push');
const PushSubscription = require('./models/PushSubscription');
const auth = require('./middleware/auth');
const recentRoutes = require('./routes/RecentRoutes');
const bannerRoutes = require('./routes/bannerRoutes');

// Check Node.js version
const nodeVersion = process.version;
console.log(`Node.js Version: ${nodeVersion}`);

const app = express();
const server = http.createServer(app);

// Add a timestamp to console logs
const log = (message) => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

// CORS configuration
app.use(cors({
  origin: '*',  // For development, update this in production
  credentials: true
}));

// Middleware
app.use(express.json());

// Connect to MongoDB with status logging
connectDB().then(() => {
  log('MongoDB Connected Successfully');
}).catch(err => {
  log('MongoDB Connection Error: ' + err.message);
});

// Remove file system operations
// const uploadDir = path.join(__dirname, 'tmp', 'uploads');
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
// }

// Initialize Socket.IO only in development
if (process.env.NODE_ENV !== 'production') {
  initializeSocket(server);
}

// Configure web-push
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// Routes
const authRoutes = require('./routes/authRoutes');
const buyerRoutes = require('./routes/buyerRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const productRoutes = require('./routes/productRoutes');
const cartRoutes = require('./routes/cartRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const orderRoutes = require('./routes/orderRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminProfileRoutes = require('./routes/adminProfileRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/buyers', buyerRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminProfileRoutes);

// Add endpoint for push subscription
app.post('/api/push-subscription', auth, async (req, res) => {
  try {
    const { subscription } = req.body;
    
    // Save or update subscription
    await PushSubscription.findOneAndUpdate(
      { userId: req.user.id },
      { 
        userId: req.user.id,
        subscription 
      },
      { upsert: true, new: true }
    );

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error saving subscription' 
    });
  }
});

// Add recent activities routes
app.use('/api/recent', recentRoutes);

// Add banner routes
app.use('/api/banners', bannerRoutes);

// Basic health check route with Node.js version
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'Server is running',
    nodeVersion: process.version,
    time: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Add request logging middleware
app.use((req, res, next) => {
  log(`${req.method} ${req.path}`);
  next();
});

// Error handling middleware with logging
app.use((err, req, res, next) => {
  log(`Error: ${err.message}`);
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
const PORT = process.env.PORT || 5000;

// Update server listening logic
if (process.env.NODE_ENV !== 'production') {
  server.listen(PORT, () => {
    log(`Server is running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    log(`Node.js Version: ${process.version}`);
    log(`Local: http://localhost:${PORT}`);
  });
} else {
  // In production (Vercel)
  log('Server initialized in production mode');
  log(`Node.js Version: ${process.version}`);
  module.exports = app;
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  log('Unhandled Promise Rejection: ' + err.message);
  console.error(err.stack);
});
