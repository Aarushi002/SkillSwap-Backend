const express = require('express');
const { body, validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Match = require('../models/Match');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/transactions
// @desc    Get user's transaction history
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { type, page = 1, limit = 20 } = req.query;

    let query = {
      $or: [
        { from: req.user.id },
        { to: req.user.id }
      ]
    };

    if (type) {
      query.type = type;
    }

    const transactions = await Transaction.find(query)
      .populate('from to', 'firstName lastName avatar')
      .populate('relatedMatch', 'skillOffered skillRequested')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/transactions/skill-exchange
// @desc    Process skill exchange transaction
// @access  Private
router.post('/skill-exchange', [
  auth,
  body('matchId').notEmpty().withMessage('Match ID is required'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('receiverId').notEmpty().withMessage('Receiver ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { matchId, amount, receiverId } = req.body;

    // Verify match exists and user is authorized
    const match = await Match.findById(matchId)
      .populate('requester receiver', 'firstName lastName tokenBalance');

    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    const isParticipant = match.requester._id.toString() === req.user.id || 
                         match.receiver._id.toString() === req.user.id;

    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized for this transaction' });
    }

    // Check if match is completed
    if (match.status !== 'completed') {
      return res.status(400).json({ message: 'Match must be completed before processing payment' });
    }

    // Verify sender has sufficient balance
    const sender = await User.findById(req.user.id);
    if (sender.tokenBalance < amount) {
      return res.status(400).json({ message: 'Insufficient token balance' });
    }

    // Create transaction
    const transaction = new Transaction({
      from: req.user.id,
      to: receiverId,
      amount,
      type: 'skill_exchange',
      description: `Payment for skill exchange: ${match.skillOffered.name}`,
      relatedMatch: matchId,
      status: 'completed',
      metadata: {
        skillName: match.skillOffered.name,
        sessionDuration: calculateSessionDuration(match),
        sessionDate: match.scheduledSession?.startTime
      }
    });

    await transaction.save();

    // Update user balances
    await User.findByIdAndUpdate(req.user.id, {
      $inc: { tokenBalance: -amount }
    });

    await User.findByIdAndUpdate(receiverId, {
      $inc: { tokenBalance: amount }
    });

    // Create notification for receiver
    const receiver = await User.findById(receiverId);
    const notification = new Notification({
      recipient: receiverId,
      type: 'payment_received',
      title: 'Payment Received',
      message: `You received ${amount} tokens from ${sender.firstName} for ${match.skillOffered.name}`,
      data: { 
        transactionId: transaction._id,
        matchId: matchId,
        userId: req.user.id
      }
    });

    await notification.save();

    res.json({
      success: true,
      transaction,
      message: 'Payment processed successfully'
    });
  } catch (error) {
    console.error('Skill exchange transaction error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/transactions/balance
// @desc    Get user's current token balance
// @access  Private
router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('tokenBalance');
    
    res.json({
      success: true,
      balance: user.tokenBalance
    });
  } catch (error) {
    console.error('Get balance error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/transactions/admin/adjust
// @desc    Admin endpoint to adjust user balances
// @access  Private (Admin only - implement admin middleware)
router.post('/admin/adjust', [
  auth,
  // Add admin middleware here
  body('userId').notEmpty().withMessage('User ID is required'),
  body('amount').isNumeric().withMessage('Amount must be a number'),
  body('reason').notEmpty().withMessage('Reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, amount, reason } = req.body;

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Create admin adjustment transaction
    const transaction = new Transaction({
      from: amount > 0 ? null : userId, // null for credit, userId for debit
      to: amount > 0 ? userId : null,   // userId for credit, null for debit
      amount: Math.abs(amount),
      type: 'admin_adjustment',
      description: `Admin adjustment: ${reason}`,
      status: 'completed'
    });

    await transaction.save();

    // Update user balance
    await User.findByIdAndUpdate(userId, {
      $inc: { tokenBalance: amount }
    });

    res.json({
      success: true,
      transaction,
      message: 'Balance adjusted successfully'
    });
  } catch (error) {
    console.error('Admin balance adjustment error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to calculate session duration
function calculateSessionDuration(match) {
  if (!match.scheduledSession?.startTime || !match.scheduledSession?.endTime) {
    return 0;
  }
  
  const start = new Date(match.scheduledSession.startTime);
  const end = new Date(match.scheduledSession.endTime);
  return Math.round((end - start) / (1000 * 60)); // Duration in minutes
}

module.exports = router;
