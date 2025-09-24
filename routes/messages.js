const express = require('express');
const { body, validationResult } = require('express-validator');
const Message = require('../models/Message');
const Match = require('../models/Match');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/messages
// @desc    Send a message
// @access  Private
router.post('/', [
  auth,
  body('matchId').notEmpty().withMessage('Match ID is required'),
  body('content').notEmpty().withMessage('Message content is required'),
  body('content').isLength({ max: 1000 }).withMessage('Message cannot exceed 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { matchId, content, type = 'text' } = req.body;

    // Verify match exists and user is authorized
    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    const isParticipant = match.requester.toString() === req.user.id || 
                         match.receiver.toString() === req.user.id;

    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized to send messages in this match' });
    }

    // Determine receiver
    const receiverId = match.requester.toString() === req.user.id ? 
                      match.receiver : match.requester;

    // Create message
    const message = new Message({
      match: matchId,
      sender: req.user.id,
      receiver: receiverId,
      content,
      type
    });

    await message.save();

    // Populate sender info for response
    await message.populate('sender', 'firstName lastName avatar');

    // Create notification for receiver
    const senderUser = await message.sender;
    const notification = new Notification({
      recipient: receiverId,
      type: 'new_message',
      title: 'New Message',
      message: `${senderUser.firstName} sent you a message`,
      data: { 
        messageId: message._id,
        matchId: matchId,
        userId: req.user.id
      }
    });

    await notification.save();

    // Emit real-time message via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${receiverId}`).emit('new_message', {
        message,
        match: matchId
      });
    }

    res.status(201).json({
      success: true,
      message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/messages/:matchId
// @desc    Get messages for a specific match
// @access  Private
router.get('/:matchId', auth, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verify match exists and user is authorized
    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    const isParticipant = match.requester.toString() === req.user.id || 
                         match.receiver.toString() === req.user.id;

    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized to view these messages' });
    }

    // Get messages
    const messages = await Message.find({ match: matchId })
      .populate('sender', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Mark messages as read by current user
    await Message.updateMany(
      { 
        match: matchId,
        receiver: req.user.id,
        'readBy.user': { $ne: req.user.id }
      },
      {
        $push: {
          readBy: {
            user: req.user.id,
            readAt: new Date()
          }
        }
      }
    );

    const total = await Message.countDocuments({ match: matchId });

    res.json({
      success: true,
      messages: messages.reverse(), // Reverse to show oldest first
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/messages/:id/read
// @desc    Mark message as read
// @access  Private
router.put('/:id/read', auth, async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);
    
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Check if user is the receiver
    if (message.receiver.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to mark this message as read' });
    }

    // Check if already marked as read by this user
    const alreadyRead = message.readBy.some(read => 
      read.user.toString() === req.user.id
    );

    if (!alreadyRead) {
      message.readBy.push({
        user: req.user.id,
        readAt: new Date()
      });
      await message.save();
    }

    res.json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    console.error('Mark message as read error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/messages/conversations/list
// @desc    Get user's conversation list (recent matches with messages)
// @access  Private
router.get('/conversations/list', auth, async (req, res) => {
  try {
    // Get user's matches with recent messages
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: req.user.id },
            { receiver: req.user.id }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$match',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiver', req.user.id] },
                    { $not: { $in: [req.user.id, '$readBy.user'] } }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'matches',
          localField: '_id',
          foreignField: '_id',
          as: 'match'
        }
      },
      {
        $unwind: '$match'
      },
      {
        $lookup: {
          from: 'users',
          localField: 'match.requester',
          foreignField: '_id',
          as: 'requester'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'match.receiver',
          foreignField: '_id',
          as: 'receiver'
        }
      },
      {
        $unwind: '$requester'
      },
      {
        $unwind: '$receiver'
      },
      {
        $project: {
          match: {
            _id: '$match._id',
            skillOffered: '$match.skillOffered',
            skillRequested: '$match.skillRequested',
            status: '$match.status',
            requester: {
              _id: '$requester._id',
              firstName: '$requester.firstName',
              lastName: '$requester.lastName',
              avatar: '$requester.avatar'
            },
            receiver: {
              _id: '$receiver._id',
              firstName: '$receiver.firstName',
              lastName: '$receiver.lastName',
              avatar: '$receiver.avatar'
            }
          },
          lastMessage: {
            content: '$lastMessage.content',
            createdAt: '$lastMessage.createdAt',
            sender: '$lastMessage.sender',
            type: '$lastMessage.type'
          },
          unreadCount: 1
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
