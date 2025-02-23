const express = require('express');
const router = express.Router();
const recentController = require('../controllers/RecentController');
const auth = require('../middleware/auth');

// Get recent activities with pagination
router.get('/', auth, recentController.getRecentActivities);

// Mark notification as read
router.put('/:notificationId/read', auth, recentController.markAsRead);

// Mark all notifications as read
router.put('/read-all', auth, recentController.markAllAsRead);

// Clear recent activities
router.post('/clear', auth, recentController.clearRecentActivities);

module.exports = router;
