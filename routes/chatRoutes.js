const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminAuth = require('../middleware/adminAuth');
const { 
    getBuyerAdminChats,
    getAdminBuyerChats,
} = require('../controllers/chatController');

// Buyer routes
router.get('/buyer-admin-chats', auth, getBuyerAdminChats);
// Admin routes
router.get('/admin-buyer-chats', auth, adminAuth, getAdminBuyerChats);

module.exports = router; 