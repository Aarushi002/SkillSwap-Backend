const jwt = require('jsonwebtoken');
const User = require('../models/User');

const socketHandler = (io) => {
  // Middleware for socket authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User ${socket.user.firstName} connected: ${socket.id}`);

    // Join user to their personal room for notifications
    socket.join(`user_${socket.userId}`);

    // Update user's online status
    updateUserStatus(socket.userId, true);

    // Handle joining match rooms for messaging
    socket.on('join_match', (matchId) => {
      socket.join(`match_${matchId}`);
      console.log(`User ${socket.userId} joined match room: ${matchId}`);
    });

    // Handle leaving match rooms
    socket.on('leave_match', (matchId) => {
      socket.leave(`match_${matchId}`);
      console.log(`User ${socket.userId} left match room: ${matchId}`);
    });

    // Handle real-time messaging
    socket.on('send_message', async (data) => {
      try {
        const { matchId, content, type = 'text' } = data;
        
        // Validate that user is part of the match
        const Match = require('../models/Match');
        const match = await Match.findById(matchId);
        
        if (!match) {
          socket.emit('error', { message: 'Match not found' });
          return;
        }

        const isParticipant = match.requester.toString() === socket.userId || 
                             match.receiver.toString() === socket.userId;

        if (!isParticipant) {
          socket.emit('error', { message: 'Not authorized for this match' });
          return;
        }

        // Create and save message
        const Message = require('../models/Message');
        const receiverId = match.requester.toString() === socket.userId ? 
                          match.receiver : match.requester;

        const message = new Message({
          match: matchId,
          sender: socket.userId,
          receiver: receiverId,
          content,
          type
        });

        await message.save();
        await message.populate('sender', 'firstName lastName avatar');

        // Emit to match room
        io.to(`match_${matchId}`).emit('new_message', {
          message,
          matchId
        });

        // Send notification to receiver if they're not in the match room
        const receiverSocketId = getUserSocketId(receiverId);
        if (!receiverSocketId || !isUserInRoom(receiverSocketId, `match_${matchId}`)) {
          io.to(`user_${receiverId}`).emit('message_notification', {
            matchId,
            sender: {
              id: socket.userId,
              firstName: socket.user.firstName,
              lastName: socket.user.lastName
            },
            preview: content.substring(0, 50)
          });
        }

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      const { matchId } = data;
      socket.to(`match_${matchId}`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.user.firstName,
        isTyping: true
      });
    });

    socket.on('typing_stop', (data) => {
      const { matchId } = data;
      socket.to(`match_${matchId}`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.user.firstName,
        isTyping: false
      });
    });

    // Handle user presence
    socket.on('user_active', () => {
      updateUserLastActive(socket.userId);
    });

    // Handle match status updates
    socket.on('match_update', (data) => {
      const { matchId, status, userId } = data;
      
      // Emit to both users involved in the match
      io.to(`user_${userId}`).emit('match_status_changed', {
        matchId,
        status,
        updatedBy: socket.userId
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${socket.user.firstName} disconnected: ${socket.id}`);
      updateUserStatus(socket.userId, false);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  // Helper functions
  function updateUserStatus(userId, isOnline) {
    User.findByIdAndUpdate(userId, {
      lastActive: new Date(),
      // You can add an isOnline field to the User model if needed
    }).catch(err => console.error('Error updating user status:', err));
  }

  function updateUserLastActive(userId) {
    User.findByIdAndUpdate(userId, {
      lastActive: new Date()
    }).catch(err => console.error('Error updating last active:', err));
  }

  function getUserSocketId(userId) {
    // Find socket ID for a specific user
    for (const [socketId, socket] of io.sockets.sockets) {
      if (socket.userId === userId) {
        return socketId;
      }
    }
    return null;
  }

  function isUserInRoom(socketId, roomName) {
    const socket = io.sockets.sockets.get(socketId);
    return socket && socket.rooms.has(roomName);
  }

  // Utility function to send notifications to specific users
  function sendNotificationToUser(userId, notification) {
    io.to(`user_${userId}`).emit('new_notification', notification);
  }

  // Utility function to broadcast system messages
  function broadcastSystemMessage(message) {
    io.emit('system_message', message);
  }

  // Export utility functions for use in other parts of the application
  io.sendNotificationToUser = sendNotificationToUser;
  io.broadcastSystemMessage = broadcastSystemMessage;
};

module.exports = socketHandler;
