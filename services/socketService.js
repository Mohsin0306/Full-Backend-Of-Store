const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');

let io;
const connectedUsers = new Map(); // Track connected users

const initializeSocket = (server) => {
  io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('authenticate', (userId) => {
      if (socket.userId === userId) {
        connectedUsers.set(userId, socket.id);
        socket.join(`user_${userId}`);
        console.log(`User ${userId} authenticated on socket ${socket.id}`);
      }
    });

    socket.on('disconnect', () => {
      if (socket.userId) {
        connectedUsers.delete(socket.userId);
      }
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
};

const sendPushNotification = async (userId, notification) => {
  try {
    const subscriptions = await PushSubscription.find({ userId });
    
    const pushPromises = subscriptions.map(async ({ subscription }) => {
      try {
        await webpush.sendNotification(subscription, JSON.stringify(notification));
      } catch (error) {
        console.error('Error sending push notification:', error);
        if (error.statusCode === 410) {
          // Subscription has expired or is no longer valid
          await PushSubscription.deleteOne({ subscription });
        }
      }
    });

    await Promise.all(pushPromises);
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
  }
};

const emitNotification = async (recipientId, notification, senderId) => {
  if (!io) {
    console.log('Socket.io not initialized');
    return;
  }

  console.log('Emitting notification:', {
    recipientId,
    type: notification.type,
    title: notification.title
  });

  const notificationData = {
    ...notification,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    senderId,
    timestamp: new Date().toISOString()
  };

  // Emit to room
  io.to(`user_${recipientId}`).emit('notification', notificationData);

  // Send push notification
  try {
    await sendPushNotification(recipientId, notificationData);
  } catch (error) {
    console.error('Push notification error:', error);
  }
};

const emitNotificationToAll = async (notification, senderId) => {
  if (!io) return;

  const notificationData = {
    ...notification,
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    senderId,
    timestamp: new Date().toISOString()
  };

  // Get all connected sockets except sender
  const sockets = Array.from(io.sockets.sockets.values())
    .filter(socket => socket.userId !== senderId);

  // Emit to all connected users except sender
  sockets.forEach(socket => {
    console.log(`Emitting notification to user ${socket.userId}`);
    socket.emit('notification', notificationData);
  });

  // Send push notifications to all except sender
  try {
    const subscriptions = await PushSubscription.find({ userId: { $ne: senderId } });
    for (const sub of subscriptions) {
      await sendPushNotification(sub.userId, notificationData);
    }
  } catch (error) {
    console.error('Error sending notifications to all:', error);
  }
};

module.exports = {
  initializeSocket,
  emitNotification,
  emitNotificationToAll
}; 