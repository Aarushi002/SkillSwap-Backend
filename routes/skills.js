const express = require('express');
const router = express.Router();

// Skill categories and predefined skills
const skillCategories = {
  Technology: [
    'JavaScript', 'Python', 'React', 'Node.js', 'MongoDB', 'SQL',
    'Machine Learning', 'Data Analysis', 'Web Development', 'Mobile Development',
    'DevOps', 'Cloud Computing', 'Cybersecurity', 'UI/UX Design'
  ],
  Design: [
    'Graphic Design', 'UI/UX Design', 'Logo Design', 'Branding',
    'Illustration', 'Photography', 'Video Editing', 'Animation',
    'Web Design', 'Print Design', 'Typography', 'Color Theory'
  ],
  Business: [
    'Project Management', 'Business Strategy', 'Marketing Strategy',
    'Sales', 'Entrepreneurship', 'Finance', 'Accounting', 'Leadership',
    'Team Management', 'Business Analysis', 'Consulting', 'Operations'
  ],
  Marketing: [
    'Digital Marketing', 'Social Media Marketing', 'Content Marketing',
    'SEO', 'PPC Advertising', 'Email Marketing', 'Brand Management',
    'Market Research', 'Copywriting', 'Analytics', 'Influencer Marketing'
  ],
  Writing: [
    'Creative Writing', 'Technical Writing', 'Copywriting', 'Blogging',
    'Content Writing', 'Journalism', 'Editing', 'Proofreading',
    'Screenwriting', 'Academic Writing', 'Translation'
  ],
  Education: [
    'Teaching', 'Tutoring', 'Curriculum Development', 'Training',
    'Educational Technology', 'Language Teaching', 'STEM Education',
    'Adult Education', 'Online Learning', 'Assessment Design'
  ],
  Health: [
    'Nutrition', 'Fitness Training', 'Yoga', 'Meditation', 'Mental Health',
    'Physical Therapy', 'Massage Therapy', 'Health Coaching',
    'Wellness Consulting', 'First Aid', 'Sports Medicine'
  ],
  Arts: [
    'Painting', 'Drawing', 'Sculpture', 'Crafts', 'Pottery',
    'Jewelry Making', 'Woodworking', 'Sewing', 'Knitting',
    'Calligraphy', 'Dance', 'Theater'
  ],
  Music: [
    'Guitar', 'Piano', 'Violin', 'Drums', 'Singing', 'Music Production',
    'Songwriting', 'Audio Engineering', 'Music Theory', 'DJing',
    'Beat Making', 'Orchestration'
  ],
  Sports: [
    'Personal Training', 'Coaching', 'Swimming', 'Tennis', 'Basketball',
    'Football', 'Martial Arts', 'Rock Climbing', 'Cycling',
    'Running', 'Weightlifting', 'Nutrition for Athletes'
  ],
  Other: [
    'Language Learning', 'Public Speaking', 'Networking', 'Time Management',
    'Problem Solving', 'Communication', 'Critical Thinking', 'Research'
  ]
};

// @route   GET /api/skills/categories
// @desc    Get all skill categories
// @access  Public
router.get('/categories', (req, res) => {
  try {
    const categories = Object.keys(skillCategories);
    res.json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/skills/category/:category
// @desc    Get skills by category
// @access  Public
router.get('/category/:category', (req, res) => {
  try {
    const { category } = req.params;
    const skills = skillCategories[category];
    
    if (!skills) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({
      success: true,
      category,
      skills
    });
  } catch (error) {
    console.error('Get skills by category error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/skills/search
// @desc    Search skills across all categories
// @access  Public
router.get('/search', (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    const searchTerm = q.toLowerCase();
    const results = [];

    Object.entries(skillCategories).forEach(([category, skills]) => {
      skills.forEach(skill => {
        if (skill.toLowerCase().includes(searchTerm)) {
          results.push({
            name: skill,
            category
          });
        }
      });
    });

    res.json({
      success: true,
      query: q,
      results: results.slice(0, 20) // Limit to 20 results
    });
  } catch (error) {
    console.error('Search skills error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/skills/trending
// @desc    Get trending skills based on user activity
// @access  Public
router.get('/trending', async (req, res) => {
  try {
    const User = require('../models/User');
    
    // Aggregate most common skills from user profiles
    const trendingSkills = await User.aggregate([
      { $unwind: '$skills' },
      {
        $group: {
          _id: {
            name: '$skills.name',
            category: '$skills.category'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
      {
        $project: {
          _id: 0,
          name: '$_id.name',
          category: '$_id.category',
          userCount: '$count'
        }
      }
    ]);

    res.json({
      success: true,
      trendingSkills
    });
  } catch (error) {
    console.error('Get trending skills error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/skills/recommendations/:userId
// @desc    Get skill recommendations based on user's current skills
// @access  Public
router.get('/recommendations/:userId', async (req, res) => {
  try {
    const User = require('../models/User');
    const { userId } = req.params;

    const user = await User.findById(userId).select('skills skillsWanted');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userSkillCategories = [...new Set(user.skills.map(skill => skill.category))];
    const userSkillNames = user.skills.map(skill => skill.name.toLowerCase());
    const wantedSkillNames = user.skillsWanted.map(skill => skill.name.toLowerCase());

    const recommendations = [];

    // Recommend skills in the same categories
    userSkillCategories.forEach(category => {
      if (skillCategories[category]) {
        skillCategories[category].forEach(skill => {
          const skillLower = skill.toLowerCase();
          if (!userSkillNames.includes(skillLower) && !wantedSkillNames.includes(skillLower)) {
            recommendations.push({
              name: skill,
              category,
              reason: 'Related to your existing skills'
            });
          }
        });
      }
    });

    // Recommend complementary skills
    const complementaryMappings = {
      'JavaScript': ['React', 'Node.js', 'Web Development'],
      'Python': ['Data Analysis', 'Machine Learning', 'Web Development'],
      'Graphic Design': ['UI/UX Design', 'Branding', 'Typography'],
      'Marketing Strategy': ['Digital Marketing', 'Content Marketing', 'Analytics']
    };

    user.skills.forEach(userSkill => {
      const complementary = complementaryMappings[userSkill.name];
      if (complementary) {
        complementary.forEach(skill => {
          const skillLower = skill.toLowerCase();
          if (!userSkillNames.includes(skillLower) && !wantedSkillNames.includes(skillLower)) {
            const category = Object.keys(skillCategories).find(cat =>
              skillCategories[cat].includes(skill)
            );
            recommendations.push({
              name: skill,
              category,
              reason: `Complements your ${userSkill.name} skills`
            });
          }
        });
      }
    });

    // Remove duplicates and limit results
    const uniqueRecommendations = recommendations.filter((skill, index, self) =>
      index === self.findIndex(s => s.name === skill.name)
    ).slice(0, 15);

    res.json({
      success: true,
      recommendations: uniqueRecommendations
    });
  } catch (error) {
    console.error('Get skill recommendations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
