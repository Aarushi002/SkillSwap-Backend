const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Transaction = require('../models/Transaction');

// @route   GET /api/stats
// @desc    Get platform statistics
// @access  Public
router.get('/', async (req, res) => {
  try {
    // Get active learners count (users who have been active within the last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const activeLearners = await User.countDocuments({
      updatedAt: { $gte: thirtyDaysAgo }
    });

    // Get total users if no recent activity filter is needed
    const totalUsers = await User.countDocuments();

    // Get unique skills count from all users
    const skillsAggregation = await User.aggregate([
      { $unwind: '$skills' },
      { $group: { _id: '$skills.name' } },
      { $count: 'uniqueSkills' }
    ]);
    
    const uniqueSkills = skillsAggregation[0]?.uniqueSkills || 0;

    // Get successful exchanges count (completed transactions)
    const successfulExchanges = await Transaction.countDocuments({
      status: 'completed'
    });

    // Get total transactions for fallback
    const totalTransactions = await Transaction.countDocuments();

    const stats = {
      activeLearners: activeLearners || totalUsers, // Fallback to total users if no recent activity
      skillsAvailable: uniqueSkills,
      successfulExchanges: successfulExchanges || totalTransactions // Fallback to total transactions
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching platform statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch platform statistics'
    });
  }
});

module.exports = router;