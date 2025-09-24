const express = require('express');
const { body, validationResult } = require('express-validator');
const Match = require('../models/Match');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const sessionScheduler = require('../services/sessionScheduler');

const router = express.Router();

// @route   GET /api/sessions
// @desc    Get user's sessions with filtering and pagination
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { status, upcoming, page = 1, limit = 10 } = req.query;
    
    let matchQuery = {
      $or: [
        { requester: req.user.id },
        { receiver: req.user.id }
      ],
      status: 'accepted',
      scheduledSession: { $exists: true }
    };

    // Filter by session status
    if (status) {
      matchQuery['scheduledSession.status'] = status;
    }

    // Filter for upcoming sessions only
    if (upcoming === 'true') {
      matchQuery['scheduledSession.startTime'] = { $gte: new Date() };
    }

    const sessions = await Match.find(matchQuery)
      .populate('requester receiver', 'firstName lastName avatar')
      .sort({ 'scheduledSession.startTime': 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Convert Maps to plain objects for JSON serialization
    const sessionsWithConvertedMaps = sessions.map(session => {
      const sessionObj = session.toObject();
      if (sessionObj.scheduledSession?.attendance instanceof Map) {
        sessionObj.scheduledSession.attendance = Object.fromEntries(sessionObj.scheduledSession.attendance);
      }
      return sessionObj;
    });

    const total = await Match.countDocuments(matchQuery);

    res.json({
      success: true,
      sessions: sessionsWithConvertedMaps,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/sessions/:id
// @desc    Get detailed session information
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const session = await Match.findById(req.params.id)
      .populate('requester receiver', 'firstName lastName avatar email');

    if (!session || !session.scheduledSession) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if user is part of the session
    const isParticipant = session.requester._id.toString() === req.user.id || 
                         session.receiver._id.toString() === req.user.id;
    
    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized to view this session' });
    }

    // Convert Maps to plain objects for JSON serialization
    const sessionObj = session.toObject();
    if (sessionObj.scheduledSession?.attendance instanceof Map) {
      sessionObj.scheduledSession.attendance = Object.fromEntries(sessionObj.scheduledSession.attendance);
    }

    res.json({
      success: true,
      session: sessionObj
    });
  } catch (error) {
    console.error('Get session error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/sessions/:id/attendance
// @desc    Mark attendance for a session
// @access  Private
router.put('/:id/attendance', [
  auth,
  body('attended').isBoolean().withMessage('Attended must be true or false'),
  body('feedback').optional().trim().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { attended, feedback } = req.body;
    
    const updatedMatch = await sessionScheduler.markAttendance(
      req.params.id, 
      req.user.id, 
      attended, 
      feedback
    );

    // Convert Maps to plain objects for JSON serialization
    const sessionObj = updatedMatch.toObject();
    if (sessionObj.scheduledSession?.attendance instanceof Map) {
      sessionObj.scheduledSession.attendance = Object.fromEntries(sessionObj.scheduledSession.attendance);
    }

    res.json({
      success: true,
      message: 'Attendance marked successfully',
      session: sessionObj
    });
  } catch (error) {
    console.error('Mark attendance error:', error);
    if (error.message === 'Session not found') {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/sessions/:id/status
// @desc    Update session status (cancel, reschedule, etc.)
// @access  Private
router.put('/:id/status', [
  auth,
  body('status').isIn(['cancelled', 'upcoming']).withMessage('Invalid status'),
  body('reason').optional().trim().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status, reason } = req.body;
    const match = await Match.findById(req.params.id)
      .populate('requester receiver', 'firstName lastName');

    if (!match || !match.scheduledSession) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if user is part of the session
    const isParticipant = match.requester._id.toString() === req.user.id || 
                         match.receiver._id.toString() === req.user.id;
    
    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized to modify this session' });
    }

    // Update session status
    match.scheduledSession.status = status;
    if (reason) {
      match.scheduledSession.cancellationReason = reason;
    }

    await match.save();

    // Notify the other participant
    const otherParticipant = match.requester._id.toString() === req.user.id ? 
                            match.receiver : match.requester;

    const notification = new Notification({
      recipient: otherParticipant._id,
      type: status === 'cancelled' ? 'session_cancelled' : 'session_updated',
      title: status === 'cancelled' ? 'Session Cancelled' : 'Session Updated',
      message: status === 'cancelled' 
        ? `Your session for ${match.skillOffered.name} has been cancelled`
        : `Your session for ${match.skillOffered.name} has been updated`,
      data: { 
        matchId: match._id, 
        userId: req.user.id,
        reason 
      }
    });

    await notification.save();

    res.json({
      success: true,
      message: `Session ${status} successfully`,
      session: match
    });
  } catch (error) {
    console.error('Update session status error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/sessions/:id/payment
// @desc    Process automatic payment for a session
// @access  Private
router.post('/:id/payment', [
  auth,
  body('amount').optional().isInt({ min: 1 }).withMessage('Amount must be a positive integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount } = req.body;
    const match = await Match.findById(req.params.id)
      .populate('requester receiver', 'firstName lastName tokenBalance');

    if (!match || !match.scheduledSession) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if user is participant
    const isParticipant = match.requester._id.toString() === req.user.id || 
                         match.receiver._id.toString() === req.user.id;
    
    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized to process payment for this session' });
    }

    // Check if session is completed
    if (match.scheduledSession.status !== 'completed') {
      return res.status(400).json({ message: 'Session must be completed before payment' });
    }

    // Check if payment already processed
    if (match.scheduledSession.paymentProcessed) {
      return res.status(400).json({ message: 'Payment already processed for this session' });
    }

    if (amount) {
      // Manual payment with specified amount
      // Check if user is the receiver (learner who should pay)
      if (match.receiver._id.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Only the learner can make manual payment' });
      }

      // Check if user has sufficient balance
      const payer = await User.findById(req.user.id);
      if (payer.tokenBalance < amount) {
        return res.status(400).json({ message: 'Insufficient token balance' });
      }

      // Create manual transaction
      const transaction = new Transaction({
        from: req.user.id,
        to: match.requester._id,
        amount,
        type: 'session_payment',
        description: `Manual payment for ${match.skillOffered.name} session`,
        relatedMatch: match._id,
        status: 'completed',
        metadata: {
          skillName: match.skillOffered.name,
          sessionDuration: sessionScheduler.calculateSessionDuration(match),
          sessionDate: match.scheduledSession.startTime,
          manual: true
        }
      });

      await transaction.save();

      // Update user balances
      await User.findByIdAndUpdate(req.user.id, {
        $inc: { tokenBalance: -amount }
      });

      await User.findByIdAndUpdate(match.requester._id, {
        $inc: { tokenBalance: amount }
      });

      // Mark payment as processed
      match.scheduledSession.paymentProcessed = true;
      await match.save();

      // Create notification for teacher
      const notification = new Notification({
        recipient: match.requester._id,
        type: 'payment_received',
        title: 'Session Payment Received',
        message: `You received ${amount} tokens from ${payer.firstName} for teaching ${match.skillOffered.name}`,
        data: {
          transactionId: transaction._id,
          amount,
          matchId: match._id
        }
      });

      await notification.save();
    } else {
      // Automatic payment processing
      console.log(`Starting automatic payment processing for session ${match._id}`);
      console.log(`Session status: ${match.scheduledSession.status}`);
      console.log(`Payment already processed: ${match.scheduledSession.paymentProcessed}`);
      console.log(`Attendance data:`, match.scheduledSession.attendance);
      
      await sessionScheduler.processSessionPayment(match);
      
      // Refresh match to get updated payment status
      await match.populate('requester receiver', 'firstName lastName tokenBalance');
    }

    // Calculate payment amount for response
    const sessionDuration = sessionScheduler.calculateSessionDuration(match);
    const hourlyRate = match.skillOffered.hourlyRate || 50;
    const calculatedAmount = Math.round((sessionDuration / 60) * hourlyRate);

    res.json({
      success: true,
      message: 'Payment processed successfully',
      details: {
        amount: amount || Math.min(calculatedAmount, 200), // Cap at 200 tokens
        sessionDuration: sessionDuration,
        skillName: match.skillOffered.name,
        teacher: `${match.requester.firstName} ${match.requester.lastName}`,
        learner: `${match.receiver.firstName} ${match.receiver.lastName}`
      }
    });
  } catch (error) {
    console.error('Process session payment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/sessions/stats
// @desc    Get session statistics for the user
// @access  Private
router.get('/stats/overview', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get session counts by status
    const sessionStats = await Match.aggregate([
      {
        $match: {
          $or: [
            { requester: userId },
            { receiver: userId }
          ],
          status: 'accepted',
          scheduledSession: { $exists: true }
        }
      },
      {
        $group: {
          _id: '$scheduledSession.status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get upcoming sessions
    const upcomingSessions = await Match.find({
      $or: [
        { requester: userId },
        { receiver: userId }
      ],
      status: 'accepted',
      'scheduledSession.startTime': { $gte: new Date() },
      'scheduledSession.status': 'upcoming'
    }).populate('requester receiver', 'firstName lastName')
      .sort({ 'scheduledSession.startTime': 1 })
      .limit(5);

    // Calculate total teaching/learning hours
    const completedSessions = await Match.find({
      $or: [
        { requester: userId },
        { receiver: userId }
      ],
      status: 'accepted',
      'scheduledSession.status': 'completed'
    });

    let totalTeachingMinutes = 0;
    let totalLearningMinutes = 0;

    completedSessions.forEach(session => {
      const duration = sessionScheduler.calculateSessionDuration(session);
      if (session.requester.toString() === userId) {
        totalTeachingMinutes += duration;
      } else {
        totalLearningMinutes += duration;
      }
    });

    res.json({
      success: true,
      stats: {
        sessionCounts: sessionStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
        upcomingSessions,
        totalTeachingHours: Math.round(totalTeachingMinutes / 60 * 10) / 10,
        totalLearningHours: Math.round(totalLearningMinutes / 60 * 10) / 10,
        completedSessionsCount: completedSessions.length
      }
    });
  } catch (error) {
    console.error('Get session stats error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/sessions/:id/rate
// @desc    Rate a completed session
// @access  Private
router.put('/:id/rate', [
  auth,
  body('rating.score').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('rating.comment').optional().trim().isLength({ max: 500 }).withMessage('Comment must be under 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { rating } = req.body;
    const match = await Match.findById(req.params.id)
      .populate('requester receiver', 'firstName lastName');

    if (!match || !match.scheduledSession) {
      return res.status(404).json({ message: 'Session not found' });
    }

    // Check if user is part of the session
    const isRequester = match.requester._id.toString() === req.user.id;
    const isReceiver = match.receiver._id.toString() === req.user.id;
    
    if (!isRequester && !isReceiver) {
      return res.status(403).json({ message: 'Not authorized to rate this session' });
    }

    // Check if session is completed
    if (match.scheduledSession.status !== 'completed') {
      return res.status(400).json({ message: 'Can only rate completed sessions' });
    }

    // Check if user attended the session
    const userAttended = match.scheduledSession.attendance.get(req.user.id)?.attended;
    if (!userAttended) {
      return res.status(400).json({ message: 'Can only rate sessions you attended' });
    }

    // Add rating
    const ratingData = {
      score: rating.score,
      comment: rating.comment || '',
      submittedAt: new Date()
    };

    if (isRequester) {
      match.scheduledSession.sessionRating.requesterRating = ratingData;
    } else {
      match.scheduledSession.sessionRating.receiverRating = ratingData;
    }

    await match.save();

    // Update user's overall rating if both participants have rated
    const sessionRating = match.scheduledSession.sessionRating;
    if (sessionRating.requesterRating && sessionRating.receiverRating) {
      const User = require('../models/User');
      
      // Update requester's rating with receiver's feedback
      const requesterUser = await User.findById(match.requester._id);
      if (requesterUser) {
        requesterUser.updateRating(sessionRating.receiverRating.score);
        await requesterUser.save();
      }

      // Update receiver's rating with requester's feedback
      const receiverUser = await User.findById(match.receiver._id);
      if (receiverUser) {
        receiverUser.updateRating(sessionRating.requesterRating.score);
        await receiverUser.save();
      }
    }

    // Convert Maps to plain objects for JSON serialization
    const matchObj = match.toObject();
    if (matchObj.scheduledSession?.attendance instanceof Map) {
      matchObj.scheduledSession.attendance = Object.fromEntries(matchObj.scheduledSession.attendance);
    }

    res.json({
      success: true,
      message: 'Session rated successfully',
      match: matchObj
    });
  } catch (error) {
    console.error('Rate session error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;