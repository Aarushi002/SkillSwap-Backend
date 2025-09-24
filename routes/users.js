const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Match = require('../models/Match');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get current user's profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    console.log('Profile route accessed by user:', req.user.id);
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: `${user.firstName} ${user.lastName}`,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone || '',
        avatar: user.avatar,
        bio: user.bio,
        location: user.location?.city || '',
        website: user.website || '',
        skills: user.skills || [],
        skillsWanted: user.skillsWanted || [],
        experience: user.experience || '',
        hourlyRate: user.hourlyRate || 0,
        availability: user.availability || {
          monday: false,
          tuesday: false,
          wednesday: false,
          thursday: false,
          friday: false,
          saturday: false,
          sunday: false
        },
        rating: user.rating,
        lastActive: user.lastActive,
        tokenBalance: user.tokenBalance
      }
    });
  } catch (error) {
    console.error('Get current user profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/profile/:id
// @desc    Get user profile by ID
// @access  Private
router.get('/profile/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        bio: user.bio,
        location: user.location,
        skills: user.skills,
        skillsWanted: user.skillsWanted,
        rating: user.rating,
        lastActive: user.lastActive
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  auth,
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('phone').optional().trim(),
  body('website').optional().trim(),
  body('bio').optional().isLength({ max: 2000 }).withMessage('Bio must be less than 2000 characters'),
  body('location').optional().trim(),
  body('experience').optional().isLength({ max: 2000 }).withMessage('Experience must be less than 2000 characters'),
  body('hourlyRate').optional().isNumeric().withMessage('Hourly rate must be a valid number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Format errors to be more user-friendly
      const formattedErrors = errors.array().map(error => ({
        field: error.path,
        message: error.msg
      }));
      return res.status(400).json({ 
        errors: formattedErrors,
        message: 'Please check the following fields and try again.'
      });
    }

    const updates = { ...req.body };
    
    // Handle name field by splitting into firstName and lastName
    if (updates.name) {
      const nameParts = updates.name.trim().split(' ');
      updates.firstName = nameParts[0];
      updates.lastName = nameParts.slice(1).join(' ') || nameParts[0];
      delete updates.name;
    }

    // Handle location field
    if (updates.location) {
      updates.location = { city: updates.location };
    }

    // Handle avatar field - strip server URL if present
    if (updates.avatar && typeof updates.avatar === 'string') {
      // Remove server URL from avatar path to store only relative path
      updates.avatar = updates.avatar.replace(/^https?:\/\/[^\/]+/, '');
      // Remove query parameters (cache busting)
      updates.avatar = updates.avatar.split('?')[0];
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updates,
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/upload-avatar
// @desc    Upload user avatar/profile picture
// @access  Private
router.post('/upload-avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No file uploaded' 
      });
    }

    // Get current user to potentially delete old avatar
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Delete old avatar file if it exists and is not a default/external URL
    if (user.avatar && user.avatar.includes('uploads/avatars/')) {
      const oldAvatarPath = path.join(__dirname, '..', user.avatar);
      if (fs.existsSync(oldAvatarPath)) {
        fs.unlinkSync(oldAvatarPath);
      }
    }

    // Generate avatar URL
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;

    // Update user avatar in database
    user.avatar = avatarUrl;
    await user.save();

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      avatar: avatarUrl,
      user: {
        ...user.toObject(),
        password: undefined
      }
    });

  } catch (error) {
    console.error('Avatar upload error:', error);
    
    // Clean up uploaded file if database update fails
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ 
      success: false, 
      message: 'Failed to upload avatar' 
    });
  }
});

// @route   GET /api/users/settings
// @desc    Get user settings
// @access  Private
router.get('/settings', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('preferences location');
    
    const settings = {
      notifications: {
        email: user.preferences?.notifications?.email || true,
        push: user.preferences?.notifications?.push || true,
        sms: false,
        newMatches: true,
        messages: true,
        sessionReminders: true,
        paymentAlerts: true,
        marketingEmails: false
      },
      privacy: {
        profileVisibility: 'public',
        showLocation: true,
        showOnlineStatus: true,
        allowDirectMessages: true,
        showSkillRatings: true
      },
      location: {
        city: user.location?.city || '',
        country: user.location?.country || '',
        timezone: '',
        searchRadius: user.preferences?.matchRadius || 25
      },
      preferences: {
        currency: 'USD',
        language: 'en',
        theme: 'light',
        defaultAvailability: 'available'
      },
      account: {
        twoFactorEnabled: false,
        loginAlerts: true,
        sessionTimeout: 30,
        dataRetention: 12
      }
    };

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/settings
// @desc    Update user settings
// @access  Private
router.put('/settings', auth, async (req, res) => {
  try {
    const { notifications, location, preferences } = req.body;
    
    const updates = {};
    
    if (notifications) {
      updates['preferences.notifications'] = {
        email: notifications.email,
        push: notifications.push
      };
    }
    
    if (location) {
      updates.location = {
        city: location.city,
        country: location.country
      };
      if (location.searchRadius) {
        updates['preferences.matchRadius'] = location.searchRadius;
      }
    }

    await User.findByIdAndUpdate(req.user.id, updates, { new: true });

    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/skills
// @desc    Add or update user skills
// @access  Private
router.post('/skills', [
  auth,
  body('skills').isArray().withMessage('Skills must be an array'),
  body('skills.*.name').notEmpty().withMessage('Skill name is required'),
  body('skills.*.category').notEmpty().withMessage('Skill category is required'),
  body('skills.*.level').isIn(['Beginner', 'Intermediate', 'Advanced', 'Expert'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { skills } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { skills },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      skills: user.skills
    });
  } catch (error) {
    console.error('Update skills error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/skills-wanted
// @desc    Update skills user wants to learn
// @access  Private
router.post('/skills-wanted', [
  auth,
  body('skillsWanted').isArray().withMessage('Skills wanted must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { skillsWanted } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { skillsWanted },
      { new: true, runValidators: true }
    ).select('-password');

    res.json({
      success: true,
      skillsWanted: user.skillsWanted
    });
  } catch (error) {
    console.error('Update skills wanted error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/discover
// @desc    Discover potential skill matches (Tinder-like algorithm)
// @access  Private
router.get('/discover', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const { page = 1, limit = 10, category, location } = req.query;

    // Get users that the current user hasn't matched with yet
    const existingMatches = await Match.find({
      $or: [
        { requester: req.user.id },
        { receiver: req.user.id }
      ]
    }).distinct('requester receiver');

    // Exclude current user and already matched users
    const excludeUsers = [...existingMatches, req.user.id];

    // Build query for potential matches
    let matchQuery = {
      _id: { $nin: excludeUsers },
      isActive: true,
      skills: { $exists: true, $ne: [] }
    };

    // Filter by category if specified
    if (category) {
      matchQuery['skills.category'] = category;
    }

    // Location-based filtering
    if (location && currentUser.location?.coordinates) {
      const radius = currentUser.preferences?.matchRadius || 50; // km
      matchQuery['location.coordinates'] = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [
              currentUser.location.coordinates.longitude,
              currentUser.location.coordinates.latitude
            ]
          },
          $maxDistance: radius * 1000 // Convert km to meters
        }
      };
    }

    const potentialMatches = await User.find(matchQuery)
      .select('-password')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ lastActive: -1 });

    // Calculate match scores
    const matchesWithScores = potentialMatches.map(user => {
      const matchScore = calculateMatchScore(currentUser, user);
      return {
        user,
        matchScore
      };
    });

    // Sort by match score
    matchesWithScores.sort((a, b) => b.matchScore - a.matchScore);

    res.json({
      success: true,
      matches: matchesWithScores,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: matchesWithScores.length
      }
    });
  } catch (error) {
    console.error('Discover matches error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Helper function to calculate match score
function calculateMatchScore(currentUser, potentialMatch) {
  let score = 0;
  
  // Check if current user's wanted skills match potential user's offered skills
  currentUser.skillsWanted?.forEach(wantedSkill => {
    potentialMatch.skills?.forEach(offeredSkill => {
      if (wantedSkill.name.toLowerCase() === offeredSkill.name.toLowerCase()) {
        score += 30; // High weight for exact skill match
      } else if (wantedSkill.category === offeredSkill.category) {
        score += 10; // Lower weight for category match
      }
    });
  });

  // Check reverse match (potential user wants current user's skills)
  potentialMatch.skillsWanted?.forEach(wantedSkill => {
    currentUser.skills?.forEach(offeredSkill => {
      if (wantedSkill.name.toLowerCase() === offeredSkill.name.toLowerCase()) {
        score += 30;
      } else if (wantedSkill.category === offeredSkill.category) {
        score += 10;
      }
    });
  });

  // Location proximity bonus
  if (currentUser.location?.coordinates && potentialMatch.location?.coordinates) {
    const distance = calculateDistance(
      currentUser.location.coordinates,
      potentialMatch.location.coordinates
    );
    if (distance <= 10) score += 15; // Very close
    else if (distance <= 25) score += 10; // Close
    else if (distance <= 50) score += 5; // Moderate distance
  }

  // Rating bonus
  if (potentialMatch.rating.average >= 4.5) score += 10;
  else if (potentialMatch.rating.average >= 4.0) score += 5;

  // Activity bonus (recently active users)
  const daysSinceActive = (Date.now() - new Date(potentialMatch.lastActive)) / (1000 * 60 * 60 * 24);
  if (daysSinceActive <= 1) score += 10;
  else if (daysSinceActive <= 7) score += 5;

  return Math.min(score, 100); // Cap at 100
}

// Helper function to calculate distance between two coordinates
function calculateDistance(coord1, coord2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);
  const lat1 = toRad(coord1.latitude);
  const lat2 = toRad(coord2.latitude);

  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(degrees) {
  return degrees * (Math.PI/180);
}

module.exports = router;
