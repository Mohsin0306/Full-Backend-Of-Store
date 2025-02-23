const Notification = require('../models/Notification');
const Buyer = require('../models/Buyer');
const { emitNotification, emitNotificationToAll } = require('../services/socketService');
const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

// Create notification for multiple users
const createNotification = async (recipients, type, title, message, data = {}, sender = null) => {
  try {
    // Filter recipients based on their notification preferences
    const allowedRecipients = [];
    for (const recipientId of recipients) {
      const buyer = await Buyer.findById(recipientId);
      if (buyer && buyer.notificationPreferences) {
        // Check notification type against user preferences
        const shouldNotify = (() => {
          switch (type) {
            case 'ORDER_STATUS':
            case 'NEW_ORDER':
              return buyer.notificationPreferences.orderUpdates;
            case 'PRICE_DROP':
              return buyer.notificationPreferences.priceAlerts;
            case 'PROMOTION':
              return buyer.notificationPreferences.promotions;
            default:
              return true; // For other notification types, default to sending
          }
        })();

        if (shouldNotify) {
          allowedRecipients.push(recipientId);
        }
      }
    }

    // If no recipients want this notification type, return early
    if (allowedRecipients.length === 0) {
      return [];
    }

    // Create notifications only for users who haven't disabled them
    const notifications = await Notification.insertMany(
      allowedRecipients.map(recipient => ({
        recipient,
        sender,
        type,
        title,
        message,
        data
      }))
    );

    // Send notifications through socket and push only to allowed recipients
    for (const notification of notifications) {
      try {
        const notificationData = {
          _id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          createdAt: notification.createdAt,
          senderId: sender,
          recipientId: notification.recipient
        };

        // Emit socket notification
        await emitNotification(notification.recipient.toString(), notificationData, sender?.toString());

        // Send push notification only if user hasn't disabled this type
        const subscriptions = await PushSubscription.find({
          userId: notification.recipient
        });

        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(
              sub.subscription,
              JSON.stringify({
                ...notificationData,
                timestamp: Date.now(),
                priority: 'high',
                vibrate: [200, 100, 200],
                requireInteraction: true,
                actions: [
                  { action: 'open', title: 'Open' },
                  { action: 'close', title: 'Close' }
                ]
              })
            );
          } catch (error) {
            if (error.statusCode === 410) {
              await PushSubscription.deleteOne({ _id: sub._id });
            }
          }
        }
      } catch (error) {
        console.error(`Error processing notification for recipient ${notification.recipient}:`, error);
        continue;
      }
    }

    return notifications;
  } catch (error) {
    console.error('Error creating notifications:', error);
    throw error;
  }
};

// Get user's notifications
const getUserNotifications = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const filter = req.query.filter || 'all';
    const search = req.query.search || '';

    // Get user's notification preferences
    const buyer = await Buyer.findById(req.user.id);
    if (!buyer || !buyer.notificationPreferences) {
      return res.status(404).json({
        success: false,
        message: 'Buyer preferences not found'
      });
    }

    let query = { recipient: req.user.id };

    // Apply filters
    if (filter === 'unread') {
      query.isRead = false;
    }

    // Apply search
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter notifications based on user preferences
    query.$or = [];
    
    if (buyer.notificationPreferences.orderUpdates) {
      query.$or.push({ type: { $in: ['ORDER_STATUS', 'NEW_ORDER'] } });
    }
    
    if (buyer.notificationPreferences.priceAlerts) {
      query.$or.push({ type: 'PRICE_DROP' });
    }
    
    if (buyer.notificationPreferences.promotions) {
      query.$or.push({ type: 'PROMOTION' });
    }

    // Always show admin messages and other types
    query.$or.push({ 
      type: { 
        $nin: ['ORDER_STATUS', 'NEW_ORDER', 'PRICE_DROP', 'PROMOTION'] 
      } 
    });

    // If no preferences are enabled, still show critical notifications
    if (query.$or.length === 1) {
      query = {
        $and: [
          { recipient: req.user.id },
          query.$or[0]
        ]
      };
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('sender', 'name username profilePicture')
      .lean();

    // Format notifications for frontend
    const formattedNotifications = notifications.map(notification => ({
      _id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      read: notification.isRead,
      createdAt: notification.createdAt,
      sender: notification.sender,
      data: notification.data,
      color: getNotificationColor(notification.type)
    }));

    res.json({
      success: true,
      notifications: formattedNotifications,
      page,
      hasMore: notifications.length === limit
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications'
    });
  }
};

// Helper function to determine notification color
const getNotificationColor = (type) => {
  switch (type) {
    case 'ORDER_STATUS':
    case 'NEW_ORDER':
      return 'blue';
    case 'ADMIN_MESSAGE':
      return 'green';
    case 'ORDER_CANCELLED':
      return 'red';
    default:
      return 'blue';
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user.id
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

    res.json({
      success: true,
      notification
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking notification as read',
      error: error.message
    });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id },
      { isRead: true }
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error marking notifications as read',
      error: error.message
    });
  }
};

// Send admin message
const sendAdminMessage = async (req, res) => {
  try {
    const { recipientIds, title, message, type = 'ADMIN_MESSAGE' } = req.body;
    const senderId = req.user.id;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    let recipients;
    if (recipientIds && recipientIds.length > 0) {
      // Send to specific users
      recipients = recipientIds;
    } else {
      // Send to all users except sender
      const buyers = await Buyer.find({ _id: { $ne: senderId } }).select('_id');
      recipients = buyers.map(buyer => buyer._id);
    }

    // Create notifications in the database
    const notifications = await Notification.create(
      recipients.map(recipientId => ({
        recipient: recipientId,
        sender: senderId,
        type,
        title,
        message,
        data: {},
        isRead: false
      }))
    );

    // Emit socket notifications
    for (const notification of notifications) {
      try {
        await emitNotification(
          notification.recipient.toString(),
          {
            _id: notification._id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            createdAt: notification.createdAt,
            senderId,
            recipientId: notification.recipient
          }
        );

        // Send push notification if available
        const subscriptions = await PushSubscription.find({
          userId: notification.recipient
        });

        for (const sub of subscriptions) {
          try {
            await webpush.sendNotification(
              sub.subscription,
              JSON.stringify({
                title: notification.title,
                message: notification.message,
                timestamp: Date.now(),
                priority: 'high',
                vibrate: [200, 100, 200]
              })
            );
          } catch (error) {
            if (error.statusCode === 410) {
              await PushSubscription.deleteOne({ _id: sub._id });
            }
          }
        }
      } catch (error) {
        console.error('Error sending notification:', error);
      }
    }

    res.json({
      success: true,
      message: 'Notifications sent successfully',
      notifications
    });
  } catch (error) {
    console.error('Error sending admin message:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending notifications',
      error: error.message
    });
  }
};

// Add this function to create order cancellation notification
const createOrderCancellationNotification = async (order, buyerName) => {
  try {
    console.log('Creating cancellation notification for order:', order._id);
    
    // Create array to hold all notifications
    let notifications = [];

    // 1. Create notification for admin users
    const adminUsers = await Buyer.find({ role: 'admin' }).select('_id');
    if (adminUsers && adminUsers.length > 0) {
      const adminNotifications = await Notification.create(
        adminUsers.map(admin => ({
          recipient: admin._id,
          sender: order.buyer,
          type: 'ORDER_CANCELLED',
          title: 'Order Cancelled',
          message: `Order #${order.orderId} has been cancelled by ${buyerName}`,
          data: {
            orderId: order._id,
            buyerId: order.buyer,
            orderStatus: 'cancelled',
            orderNumber: order.orderId,
            cancelReason: order.cancelReason
          },
          isRead: false
        }))
      );
      notifications = notifications.concat(adminNotifications);
    }

    // 2. Create notification for the buyer
    const buyerNotification = await Notification.create({
      recipient: order.buyer,
      type: 'ORDER_CANCELLED',
      title: 'Order Cancelled',
      message: `Your order #${order.orderId} has been cancelled successfully`,
      data: {
        orderId: order._id,
        orderStatus: 'cancelled',
        orderNumber: order.orderId,
        cancelReason: order.cancelReason
      },
      isRead: false
    });
    notifications.push(buyerNotification);

    // 3. Emit socket notifications to all recipients
    for (const notification of notifications) {
      try {
        await emitNotification(
          notification.recipient.toString(),
          {
            _id: notification._id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            data: notification.data,
            createdAt: notification.createdAt,
            senderId: order.buyer,
            recipientId: notification.recipient
          },
          order.buyer.toString()
        );
      } catch (error) {
        console.error('Error emitting notification:', error);
      }
    }

    return notifications;
  } catch (error) {
    console.error('Error in createOrderCancellationNotification:', error);
    throw error;
  }
};

// Get notification by ID
const getNotificationById = async (req, res) => {
  try {
    console.log('Fetching notification with ID:', req.params.id);
    console.log('User ID:', req.user.id);

    const notification = await Notification.findOne({
      _id: req.params.id,
      $or: [
        { recipient: req.user.id },
        { sender: req.user.id }
      ]
    })
    .populate('sender', 'name username profilePicture businessDetails')
    .populate('recipient', 'name username profilePicture');

    console.log('Found notification:', notification);

    if (!notification) {
      console.log('Notification not found');
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    // Format the sender name based on whether it's a business or regular user
    const formattedNotification = {
      ...notification.toObject(),
      sender: notification.sender ? {
        ...notification.sender.toObject(),
        name: notification.sender.businessDetails?.companyName || notification.sender.name
      } : null,
      recipient: notification.recipient ? {
        ...notification.recipient.toObject(),
        name: notification.recipient.name
      } : null
    };

    // Mark notification as read when viewed
    if (!notification.isRead && notification.recipient.toString() === req.user.id) {
      await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
    }

    console.log('Sending formatted notification:', formattedNotification);

    res.json({
      success: true,
      notification: formattedNotification
    });
  } catch (error) {
    console.error('Error fetching notification:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notification details',
      error: error.message
    });
  }
};

// Get notification preferences
const getNotificationPreferences = async (req, res) => {
  try {
    const buyer = await Buyer.findById(req.user.id);
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    // Get or initialize preferences
    const preferences = {
      orderUpdates: buyer.notificationPreferences?.orderUpdates ?? true,
      promotions: buyer.notificationPreferences?.promotions ?? false,
      priceAlerts: buyer.notificationPreferences?.priceAlerts ?? true
    };

    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching notification preferences',
      error: error.message
    });
  }
};

// Update notification preferences
const updateNotificationPreferences = async (req, res) => {
  try {
    const { type, enabled } = req.body;

    // Validate the notification type
    if (!['orderUpdates', 'promotions', 'priceAlerts'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid notification type'
      });
    }

    const buyer = await Buyer.findById(req.user.id);
    if (!buyer) {
      return res.status(404).json({
        success: false,
        message: 'Buyer not found'
      });
    }

    // Initialize preferences if they don't exist
    if (!buyer.notificationPreferences) {
      buyer.notificationPreferences = {
        orderUpdates: true,
        promotions: false,
        priceAlerts: true
      };
    }

    // Update the specific preference
    buyer.notificationPreferences[type] = enabled;

    await buyer.save();

    // Return all preferences
    res.json({
      success: true,
      message: 'Notification preferences updated successfully',
      preferences: buyer.notificationPreferences
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating notification preferences',
      error: error.message
    });
  }
};

module.exports = {
  createNotification,
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  sendAdminMessage,
  createOrderCancellationNotification,
  getNotificationById,
  getNotificationPreferences,
  updateNotificationPreferences
}; 