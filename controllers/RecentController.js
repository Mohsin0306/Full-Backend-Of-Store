const Notification = require('../models/Notification');
const mongoose = require('mongoose');

const recentController = {
  // Get recent notifications with pagination and filtering
  getRecentActivities: async (req, res) => {
    try {
      const { page = 1, limit = 20, after } = req.query;
      const userId = req.user.id;

      // Build query - Create ObjectId properly
      const query = {
        recipient: new mongoose.Types.ObjectId(userId),
        hidden: false
      };

      // Add date filter if 'after' is provided
      if (after) {
        const afterDate = new Date(after);
        // Ensure the date is valid
        if (!isNaN(afterDate.getTime())) {
          query.createdAt = { $gte: afterDate };
        }
      }

      console.log('Query:', JSON.stringify(query, null, 2)); // Debug log

      // Execute query with pagination
      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * parseInt(limit))
        .limit(parseInt(limit))
        .populate('data.productId', 'name images price')
        .populate('data.orderId', 'orderId totalAmount status');

      // Get total count for pagination
      const total = await Notification.countDocuments(query);

      console.log(`Found ${notifications.length} notifications`); // Debug log

      res.status(200).json({
        success: true,
        notifications,
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        hasMore: (page * parseInt(limit)) < total
      });
    } catch (error) {
      console.error('Error in getRecentActivities:', error);
      res.status(500).json({
        success: false,
        message: 'Error fetching recent activities',
        error: error.message
      });
    }
  },

  // Mark notification as read
  markAsRead: async (req, res) => {
    try {
      const { notificationId } = req.params;
      const userId = req.user.id;

      const notification = await Notification.findOneAndUpdate(
        {
          _id: new mongoose.Types.ObjectId(notificationId),
          recipient: new mongoose.Types.ObjectId(userId)
        },
        { isRead: true },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.status(200).json({
        success: true,
        notification
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        message: 'Error marking notification as read'
      });
    }
  },

  // Mark all notifications as read
  markAllAsRead: async (req, res) => {
    try {
      const userId = req.user.id;

      await Notification.updateMany(
        {
          recipient: new mongoose.Types.ObjectId(userId),
          isRead: false
        },
        { isRead: true }
      );

      res.status(200).json({
        success: true,
        message: 'All notifications marked as read'
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      res.status(500).json({
        success: false,
        message: 'Error marking all notifications as read'
      });
    }
  },

  // Clear recent activities (hide from view)
  clearRecentActivities: async (req, res) => {
    try {
      const userId = req.user.id;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      // Validate user ID format
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format'
        });
      }

      const query = {
        recipient: new mongoose.Types.ObjectId(userId)
      };

      // Add date filter if provided in query params
      if (req.query.before) {
        const beforeDate = new Date(req.query.before);
        if (!isNaN(beforeDate.getTime())) {
          query.createdAt = { $lte: beforeDate };
        }
      }

      // Execute the update
      const result = await Notification.updateMany(
        query,
        { $set: { hidden: true } }
      );

      console.log('Clear result:', result); // Debug log

      res.status(200).json({
        success: true,
        message: 'Recent activities cleared',
        modifiedCount: result.modifiedCount
      });
    } catch (error) {
      console.error('Error in clearRecentActivities:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to clear recent activities',
        error: error.message
      });
    }
  }
};

module.exports = recentController;
