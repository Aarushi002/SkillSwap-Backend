const express = require('express');
const { body, validationResult } = require('express-validator');
const Match = require('../models/Match');
const User = require('../models/User');
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/matches
// @desc    Create a new match request
// @access  Private
router.post('/', [
  auth,
  body('receiverId').notEmpty().withMessage('Receiver ID is required'),
  body('skillOffered.name').notEmpty().withMessage('Offered skill name is required'),
  body('skillRequested.name').notEmpty().withMessage('Requested skill name is required'),
  body('message').optional().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { receiverId, skillOffered, skillRequested, message } = req.body;

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if match already exists
    const existingMatch = await Match.findOne({
      requester: req.user.id,
      receiver: receiverId,
      'skillOffered.name': skillOffered.name
    });

    if (existingMatch) {
      return res.status(400).json({ message: 'Match request already exists' });
    }

    // Calculate match score
    const requester = await User.findById(req.user.id);
    const matchScore = calculateMatchScore(requester, receiver, skillOffered, skillRequested);

    // Create match
    const match = new Match({
      requester: req.user.id,
      receiver: receiverId,
      skillOffered,
      skillRequested,
      message,
      matchScore
    });

    await match.save();

    // Create notification for receiver
    const notification = new Notification({
      recipient: receiverId,
      type: 'new_match',
      title: 'New Skill Match Request',
      message: `${requester.firstName} wants to exchange ${skillRequested.name} for ${skillOffered.name}`,
      data: { matchId: match._id, userId: req.user.id }
    });

    await notification.save();

    // Send email notification if user has email notifications enabled
    if (receiver.preferences?.notifications?.email) {
      try {
        const emailService = require('../services/emailService');
        await emailService.sendMatchNotification(receiver, match, requester);
      } catch (emailError) {
        console.error('Match notification email failed:', emailError);
      }
    }

    // Populate match data for response
    await match.populate('requester receiver', 'firstName lastName avatar rating');

    res.status(201).json({
      success: true,
      match
    });
  } catch (error) {
    console.error('Create match error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/matches
// @desc    Get user's matches
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { status, type = 'all', page = 1, limit = 10 } = req.query;

    let matchQuery = {
      $or: [
        { requester: req.user.id },
        { receiver: req.user.id }
      ]
    };

    if (status) {
      matchQuery.status = status;
    }

    if (type === 'sent') {
      matchQuery = { requester: req.user.id };
    } else if (type === 'received') {
      matchQuery = { receiver: req.user.id };
    }

    const matches = await Match.find(matchQuery)
      .populate('requester receiver', 'firstName lastName avatar rating location')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Convert Maps to plain objects for JSON serialization
    const matchesWithConvertedMaps = matches.map(match => {
      const matchObj = match.toObject();
      if (matchObj.scheduledSession?.attendance instanceof Map) {
        matchObj.scheduledSession.attendance = Object.fromEntries(matchObj.scheduledSession.attendance);
      }
      return matchObj;
    });

    const total = await Match.countDocuments(matchQuery);

    res.json({
      success: true,
      matches: matchesWithConvertedMaps,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/matches/:id/respond
// @desc    Respond to a match request (accept/reject)
// @access  Private
router.put('/:id/respond', [
  auth,
  body('action').isIn(['accept', 'reject']).withMessage('Action must be accept or reject')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { action } = req.body;
    const match = await Match.findById(req.params.id)
      .populate('requester receiver', 'firstName lastName');

    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    // Check if user is the receiver
    if (match.receiver._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to respond to this match' });
    }

    // Check if match is still pending
    if (match.status !== 'pending') {
      return res.status(400).json({ message: 'Match has already been responded to' });
    }

    // Update match status
    match.status = action === 'accept' ? 'accepted' : 'rejected';
    await match.save();

    // Create notification for requester
    const notification = new Notification({
      recipient: match.requester._id,
      type: action === 'accept' ? 'match_accepted' : 'match_rejected',
      title: `Match ${action === 'accept' ? 'Accepted' : 'Rejected'}`,
      message: `${match.receiver.firstName} has ${action}ed your skill exchange request`,
      data: { matchId: match._id, userId: req.user.id }
    });

    await notification.save();

    // Send email notification if match was accepted and user has email notifications enabled
    if (action === 'accept') {
      const requesterUser = await User.findById(match.requester._id);
      if (requesterUser.preferences?.notifications?.email) {
        try {
          const emailService = require('../services/emailService');
          await emailService.sendMatchAcceptedNotification(requesterUser, match, match.receiver);
        } catch (emailError) {
          console.error('Match accepted email failed:', emailError);
        }
      }
    }

    res.json({
      success: true,
      match,
      message: `Match ${action}ed successfully`
    });
  } catch (error) {
    console.error('Respond to match error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/matches/:id/schedule
// @desc    Schedule a session for an accepted match
// @access  Private
router.put('/:id/schedule', [
  auth,
  body('startTime').isISO8601().withMessage('Valid start time is required'),
  body('endTime').isISO8601().withMessage('Valid end time is required'),
  body('location').optional().trim(),
  body('type').isIn(['online', 'in-person']).withMessage('Type must be online or in-person')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startTime, endTime, location, type } = req.body;
    const match = await Match.findById(req.params.id)
      .populate('requester receiver', 'firstName lastName');

    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    // Check if user is part of the match
    const isParticipant = match.requester._id.toString() === req.user.id || 
                         match.receiver._id.toString() === req.user.id;
    
    if (!isParticipant) {
      return res.status(403).json({ message: 'Not authorized to schedule this match' });
    }

    // Check if match is accepted
    if (match.status !== 'accepted') {
      return res.status(400).json({ message: 'Match must be accepted before scheduling' });
    }

    // Validate time
    if (new Date(startTime) >= new Date(endTime)) {
      return res.status(400).json({ message: 'End time must be after start time' });
    }

    // Update match with schedule
    match.scheduledSession = {
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      location: location || '',
      type,
      status: 'upcoming',
      attendance: new Map()
    };

    await match.save();

    // Notify the other participant
    const otherParticipant = match.requester._id.toString() === req.user.id ? 
                            match.receiver : match.requester;

    const notification = new Notification({
      recipient: otherParticipant._id,
      type: 'session_scheduled',
      title: 'Session Scheduled',
      message: `A session has been scheduled for ${new Date(startTime).toLocaleString()}`,
      data: { matchId: match._id, userId: req.user.id }
    });

    await notification.save();

    // Convert Maps to plain objects for JSON serialization
    const matchObj = match.toObject();
    if (matchObj.scheduledSession?.attendance instanceof Map) {
      matchObj.scheduledSession.attendance = Object.fromEntries(matchObj.scheduledSession.attendance);
    }

    res.json({
      success: true,
      match: matchObj,
      message: 'Session scheduled successfully'
    });
  } catch (error) {
    console.error('Schedule session error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/matches/:id/complete
// @desc    Mark a match as completed and handle ratings
// @access  Private
router.put('/:id/complete', [
  auth,
  body('rating.score').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('rating.comment').optional().trim().isLength({ max: 300 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { rating } = req.body;
    const match = await Match.findById(req.params.id)
      .populate('requester receiver', 'firstName lastName');

    if (!match) {
      return res.status(404).json({ message: 'Match not found' });
    }

    // Check if user is part of the match
    const isRequester = match.requester._id.toString() === req.user.id;
    const isReceiver = match.receiver._id.toString() === req.user.id;
    
    if (!isRequester && !isReceiver) {
      return res.status(403).json({ message: 'Not authorized to complete this match' });
    }

    // Update rating
    if (isRequester) {
      match.rating.requesterRating = rating;
    } else {
      match.rating.receiverRating = rating;
    }

    // Check if both users have rated
    const bothRated = match.rating.requesterRating && match.rating.receiverRating;
    
    if (bothRated) {
      match.status = 'completed';
      
      // Update user ratings
      const requesterUser = await User.findById(match.requester._id);
      const receiverUser = await User.findById(match.receiver._id);
      
      requesterUser.updateRating(match.rating.receiverRating.score);
      receiverUser.updateRating(match.rating.requesterRating.score);
      
      await requesterUser.save();
      await receiverUser.save();
    }

    await match.save();

    res.json({
      success: true,
      match,
      message: bothRated ? 'Match completed successfully' : 'Rating submitted, waiting for other user'
    });
  } catch (error) {
    console.error('Complete match error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to calculate match score
function calculateMatchScore(requester, receiver, skillOffered, skillRequested) {
  let score = 0;

  // Check if receiver has the requested skill
  const hasRequestedSkill = receiver.skills?.some(skill => 
    skill.name.toLowerCase() === skillRequested.name.toLowerCase()
  );
  if (hasRequestedSkill) score += 40;

  // Check if receiver wants the offered skill
  const wantsOfferedSkill = receiver.skillsWanted?.some(skill =>
    skill.name.toLowerCase() === skillOffered.name.toLowerCase()
  );
  if (wantsOfferedSkill) score += 40;

  // Location proximity
  if (requester.location?.coordinates && receiver.location?.coordinates) {
    // Add location-based scoring logic here
    score += 10;
  }

  // Rating bonus
  if (receiver.rating.average >= 4.0) score += 10;

  return Math.min(score, 100);
}

module.exports = router;
