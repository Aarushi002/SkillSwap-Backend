const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Match = require('../models/Match');
const Transaction = require('../models/Transaction');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
require('dotenv').config();

// Skill categories from the frontend
const SKILL_CATEGORIES = [
  'Technology & Programming',
  'Design & Creative',
  'Business & Finance',
  'Marketing & Sales',
  'Writing & Communication',
  'Education & Training',
  'Health & Wellness',
  'Music & Arts',
  'Languages',
  'Crafts & DIY',
  'Sports & Fitness',
  'Cooking & Culinary',
  'Photography & Video',
  'Consulting & Strategy',
  'Data & Analytics',
  'Engineering',
  'Legal & Compliance',
  'Project Management',
  'Customer Service',
  'Other'
];

// Sample skills by category
const SKILLS_BY_CATEGORY = {
  'Technology & Programming': ['JavaScript', 'Python', 'React', 'Node.js', 'PHP', 'Java', 'C++', 'Mobile Development', 'DevOps', 'Cybersecurity'],
  'Design & Creative': ['Graphic Design', 'UI/UX Design', 'Logo Design', 'Illustration', 'Branding', 'Web Design', 'Print Design', '3D Modeling', 'Animation', 'Adobe Creative Suite'],
  'Business & Finance': ['Financial Planning', 'Accounting', 'Investment Analysis', 'Business Strategy', 'Market Research', 'Budgeting', 'Tax Preparation', 'Risk Management', 'Excel', 'QuickBooks'],
  'Marketing & Sales': ['Digital Marketing', 'SEO', 'Social Media Marketing', 'Content Marketing', 'Email Marketing', 'Sales Strategy', 'Lead Generation', 'PPC Advertising', 'Brand Management', 'CRM'],
  'Writing & Communication': ['Content Writing', 'Copywriting', 'Technical Writing', 'Blog Writing', 'Proofreading', 'Translation', 'Editing', 'Grant Writing', 'Public Speaking', 'Creative Writing'],
  'Education & Training': ['Online Teaching', 'Curriculum Development', 'Training Design', 'E-learning', 'Tutoring', 'Workshop Facilitation', 'Educational Technology', 'Assessment Design', 'Adult Learning', 'Course Creation'],
  'Health & Wellness': ['Nutrition Counseling', 'Fitness Training', 'Yoga Instruction', 'Mental Health Support', 'Massage Therapy', 'Health Coaching', 'Meditation', 'Physical Therapy', 'Wellness Planning', 'First Aid'],
  'Music & Arts': ['Piano', 'Guitar', 'Singing', 'Music Production', 'Songwriting', 'Audio Engineering', 'Music Theory', 'DJ Skills', 'Band Management', 'Music Marketing'],
  'Languages': ['English', 'Spanish', 'French', 'German', 'Mandarin', 'Japanese', 'Arabic', 'Portuguese', 'Italian', 'Russian'],
  'Crafts & DIY': ['Woodworking', 'Knitting', 'Pottery', 'Jewelry Making', 'Sewing', 'Home Repair', 'Gardening', 'Painting', 'Crafting', 'Furniture Restoration'],
  'Sports & Fitness': ['Personal Training', 'Swimming', 'Tennis', 'Basketball', 'Soccer', 'Martial Arts', 'Running Coaching', 'Strength Training', 'Pilates', 'Dance'],
  'Cooking & Culinary': ['Baking', 'International Cuisine', 'Meal Planning', 'Food Photography', 'Wine Pairing', 'Vegetarian Cooking', 'Pastry Making', 'Grilling', 'Knife Skills', 'Menu Development'],
  'Photography & Video': ['Portrait Photography', 'Video Editing', 'Wedding Photography', 'Product Photography', 'Videography', 'Photo Editing', 'Drone Photography', 'Event Photography', 'Documentary', 'Studio Lighting'],
  'Consulting & Strategy': ['Business Consulting', 'Strategy Development', 'Process Improvement', 'Change Management', 'Operations Consulting', 'IT Consulting', 'HR Consulting', 'Management Consulting', 'Startup Consulting', 'Digital Transformation'],
  'Data & Analytics': ['Data Analysis', 'Statistical Analysis', 'Data Visualization', 'SQL', 'Machine Learning', 'Business Intelligence', 'Excel Analytics', 'R Programming', 'Tableau', 'Power BI'],
  'Engineering': ['Mechanical Engineering', 'Electrical Engineering', 'Software Engineering', 'Civil Engineering', 'Chemical Engineering', 'Systems Engineering', 'Quality Engineering', 'Product Engineering', 'Manufacturing', 'CAD Design'],
  'Legal & Compliance': ['Contract Review', 'Legal Research', 'Compliance Consulting', 'Intellectual Property', 'Employment Law', 'Business Law', 'Regulatory Compliance', 'Legal Writing', 'Mediation', 'Paralegal Services'],
  'Project Management': ['Agile Management', 'Scrum Master', 'Project Planning', 'Risk Management', 'Resource Management', 'Timeline Management', 'Team Leadership', 'Budget Management', 'Stakeholder Management', 'Process Optimization'],
  'Customer Service': ['Customer Support', 'Help Desk', 'Customer Success', 'Technical Support', 'Call Center', 'Live Chat Support', 'Customer Relations', 'Complaint Resolution', 'Customer Training', 'Service Strategy'],
  'Other': ['Virtual Assistant', 'Event Planning', 'Research', 'Data Entry', 'Administrative Support', 'Travel Planning', 'Real Estate', 'Insurance', 'Logistics', 'Quality Assurance']
};

// Sample user data
const SAMPLE_USERS = [
  {
    firstName: 'Alice',
    lastName: 'Johnson',
    email: 'alice.johnson@example.com',
    bio: 'Experienced web developer with a passion for creating innovative solutions. I love helping others learn programming and building amazing user experiences.',
    experience: 'Senior Full Stack Developer at TechCorp for 5 years. Previously worked at StartupXYZ as Lead Frontend Developer. Built multiple e-commerce platforms and SaaS applications.',
    location: 'San Francisco, CA',
    hourlyRate: 75,
    website: 'https://alicejohnson.dev',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b8f5?w=150&h=150&fit=crop&crop=face'
  },
  {
    firstName: 'Bob',
    lastName: 'Smith',
    email: 'bob.smith@example.com',
    bio: 'Creative graphic designer specializing in brand identity and digital marketing materials. Always excited to collaborate on visual storytelling projects.',
    experience: 'Freelance Graphic Designer for 3 years. Former Art Director at Creative Agency Inc. Designed campaigns for Fortune 500 companies.',
    location: 'New York, NY',
    hourlyRate: 60,
    website: 'https://bobsmithdesign.com',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
  },
  {
    firstName: 'Carol',
    lastName: 'Williams',
    email: 'carol.williams@example.com',
    bio: 'Digital marketing strategist with expertise in SEO, content marketing, and social media. I help businesses grow their online presence.',
    experience: 'Marketing Manager at DigitalFirst Agency for 4 years. Specialized in B2B SaaS marketing. Managed campaigns with $500K+ budgets.',
    location: 'Austin, TX',
    hourlyRate: 50,
    website: 'https://carolwilliamsmarketing.com',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face'
  },
  {
    firstName: 'David',
    lastName: 'Brown',
    email: 'david.brown@example.com',
    bio: 'Professional photographer with 10+ years of experience in weddings, events, and portrait photography. Love capturing special moments.',
    experience: 'Owner of Brown Photography Studio. Shot over 200 weddings and numerous corporate events. Published in Wedding Magazine.',
    location: 'Los Angeles, CA',
    hourlyRate: 80,
    website: 'https://davidbrownphoto.com',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face'
  },
  {
    firstName: 'Emma',
    lastName: 'Davis',
    email: 'emma.davis@example.com',
    bio: 'Certified personal trainer and nutrition coach. Passionate about helping people achieve their fitness goals and live healthier lives.',
    experience: 'Personal Trainer at FitLife Gym for 6 years. Certified in NASM and precision nutrition. Helped 100+ clients reach their goals.',
    location: 'Miami, FL',
    hourlyRate: 45,
    website: 'https://emmafitness.com',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face'
  },
  {
    firstName: 'Frank',
    lastName: 'Miller',
    email: 'frank.miller@example.com',
    bio: 'Financial advisor and investment consultant. I help individuals and small businesses make smart financial decisions.',
    experience: 'Senior Financial Advisor at WealthCorp for 8 years. CFA certified. Managed portfolios worth $50M+.',
    location: 'Chicago, IL',
    hourlyRate: 100,
    website: 'https://frankmillerfinance.com',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
  },
  {
    firstName: 'Grace',
    lastName: 'Wilson',
    email: 'grace.wilson@example.com',
    bio: 'Professional writer and editor specializing in technical documentation and content marketing. Love making complex topics accessible.',
    experience: 'Technical Writer at SoftwareInc for 5 years. Previously freelanced for various tech startups. Published author.',
    location: 'Seattle, WA',
    hourlyRate: 55,
    website: 'https://gracewilsonwrites.com',
    avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face'
  },
  {
    firstName: 'Henry',
    lastName: 'Garcia',
    email: 'henry.garcia@example.com',
    bio: 'Experienced Spanish teacher and translator. Native speaker with a passion for language education and cultural exchange.',
    experience: 'Spanish Instructor at Language Academy for 7 years. Certified in DELE and SIELE. Translated for UN conferences.',
    location: 'Phoenix, AZ',
    hourlyRate: 40,
    website: 'https://henryspanishtutor.com',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=face'
  },
  {
    firstName: 'Ivy',
    lastName: 'Chen',
    email: 'ivy.chen@example.com',
    bio: 'Data scientist and machine learning engineer. Passionate about using data to solve real-world problems and drive business insights.',
    experience: 'Data Scientist at DataCorp for 4 years. PhD in Statistics. Built ML models for predictive analytics and recommendation systems.',
    location: 'San Jose, CA',
    hourlyRate: 90,
    website: 'https://ivychendata.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face'
  },
  {
    firstName: 'Jack',
    lastName: 'Taylor',
    email: 'jack.taylor@example.com',
    bio: 'Project manager with expertise in agile methodologies. I help teams deliver projects on time and within budget.',
    experience: 'Senior Project Manager at ProjectPro for 6 years. PMP certified. Managed projects worth $10M+ across various industries.',
    location: 'Denver, CO',
    hourlyRate: 70,
    website: 'https://jacktaylorpm.com',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face'
  },
  // Health & Wellness Specialist
  {
    firstName: 'Kelly',
    lastName: 'Martinez',
    email: 'kelly.martinez@example.com',
    bio: 'Certified yoga instructor and wellness coach. Passionate about holistic health and helping people find balance in their lives.',
    experience: 'RYT-500 Yoga Instructor for 8 years. Wellness Coach certified by NCHEC. Specializes in stress management and mindfulness.',
    location: 'San Diego, CA',
    hourlyRate: 65,
    website: 'https://kellywellness.com',
    avatar: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=150&h=150&fit=crop&crop=face'
  },
  // Music & Arts Expert
  {
    firstName: 'Marcus',
    lastName: 'Thompson',
    email: 'marcus.thompson@example.com',
    bio: 'Professional musician and music producer with 15+ years in the industry. Love teaching and sharing the joy of music.',
    experience: 'Lead guitarist for indie band "Echo Dreams". Music producer with credits on 50+ albums. Berklee College of Music graduate.',
    location: 'Nashville, TN',
    hourlyRate: 85,
    website: 'https://marcusmusic.com',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
  },
  // Crafts & DIY Enthusiast
  {
    firstName: 'Nina',
    lastName: 'Rodriguez',
    email: 'nina.rodriguez@example.com',
    bio: 'Master craftsperson specializing in woodworking and pottery. I believe in the power of creating with your hands.',
    experience: 'Owner of "Handmade Haven" workshop for 10 years. Certified in traditional woodworking techniques. Featured in Craft Magazine.',
    location: 'Portland, OR',
    hourlyRate: 50,
    website: 'https://ninacrafts.com',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face'
  },
  // Sports & Fitness Coach
  {
    firstName: 'Oliver',
    lastName: 'Kim',
    email: 'oliver.kim@example.com',
    bio: 'Former professional athlete turned fitness coach. Specializing in strength training and athletic performance.',
    experience: 'Olympic weightlifting competitor for 8 years. NASM certified personal trainer. Coached 200+ athletes to championship levels.',
    location: 'Los Angeles, CA',
    hourlyRate: 90,
    website: 'https://oliverfitness.com',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face'
  },
  // Culinary Arts Chef
  {
    firstName: 'Priya',
    lastName: 'Patel',
    email: 'priya.patel@example.com',
    bio: 'Executive chef with expertise in international cuisine. Passionate about teaching authentic cooking techniques from around the world.',
    experience: 'Head Chef at Michelin-starred restaurant for 12 years. Culinary Institute graduate. Authored cookbook "Flavors of the World".',
    location: 'New York, NY',
    hourlyRate: 95,
    website: 'https://priyacooks.com',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face'
  },
  // Engineering Professional
  {
    firstName: 'Quinn',
    lastName: 'Anderson',
    email: 'quinn.anderson@example.com',
    bio: 'Mechanical engineer with expertise in product design and manufacturing. Love solving complex technical problems.',
    experience: 'Senior Mechanical Engineer at Tesla for 7 years. PhD in Mechanical Engineering from MIT. 15+ patents in automotive design.',
    location: 'Detroit, MI',
    hourlyRate: 110,
    website: 'https://quinnengineer.com',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
  },
  // Legal & Compliance Expert
  {
    firstName: 'Rachel',
    lastName: 'Williams',
    email: 'rachel.williams@example.com',
    bio: 'Corporate lawyer specializing in intellectual property and business law. Helping startups navigate legal complexities.',
    experience: 'Partner at Williams & Associates Law Firm. Harvard Law School graduate. 15 years experience in corporate law.',
    location: 'Boston, MA',
    hourlyRate: 150,
    website: 'https://rachellaw.com',
    avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face'
  },
  // Customer Service Specialist
  {
    firstName: 'Samuel',
    lastName: 'Lee',
    email: 'samuel.lee@example.com',
    bio: 'Customer experience expert with a passion for building lasting relationships. Specialized in customer success strategies.',
    experience: 'Head of Customer Success at SaaS company for 9 years. Certified Customer Success Manager. Improved retention rates by 40%.',
    location: 'Seattle, WA',
    hourlyRate: 60,
    website: 'https://samuelcx.com',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=face'
  },
  // Education & Training Specialist
  {
    firstName: 'Tessa',
    lastName: 'Brown',
    email: 'tessa.brown@example.com',
    bio: 'Educational technology specialist and curriculum designer. Passionate about creating engaging learning experiences.',
    experience: 'Instructional Designer at EdTech company for 6 years. M.Ed in Educational Technology. Created courses for 50K+ students.',
    location: 'Austin, TX',
    hourlyRate: 75,
    website: 'https://tessateaches.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face'
  },
  // Multi-Language Teacher
  {
    firstName: 'Viktor',
    lastName: 'Petrov',
    email: 'viktor.petrov@example.com',
    bio: 'Polyglot language instructor fluent in 8 languages. Specialized in accelerated language learning techniques.',
    experience: 'Language instructor for 12 years. MA in Applied Linguistics. Taught diplomats and business executives. Fluent in 8 languages.',
    location: 'Washington, DC',
    hourlyRate: 80,
    website: 'https://viktorlanguages.com',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face'
  },
  // Consulting & Strategy Expert
  {
    firstName: 'Wendy',
    lastName: 'Chang',
    email: 'wendy.chang@example.com',
    bio: 'Management consultant specializing in digital transformation and organizational change. Helping companies adapt to the digital age.',
    experience: 'Senior Consultant at McKinsey & Company for 8 years. MBA from Wharton. Led digital transformation for Fortune 500 companies.',
    location: 'San Francisco, CA',
    hourlyRate: 200,
    website: 'https://wendyconsulting.com',
    avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b8f5?w=150&h=150&fit=crop&crop=face'
  },
  // Other/Virtual Assistant
  {
    firstName: 'Xavier',
    lastName: 'Johnson',
    email: 'xavier.johnson@example.com',
    bio: 'Professional virtual assistant and administrative expert. Specializing in executive support and business operations.',
    experience: 'Virtual Assistant for C-level executives for 7 years. Certified in project management and office administration.',
    location: 'Remote',
    hourlyRate: 45,
    website: 'https://xavierva.com',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
  }
];

// Helper functions
const getRandomElement = (array) => array[Math.floor(Math.random() * array.length)];
const getRandomElements = (array, count) => {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};
const getRandomNumber = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomBoolean = () => Math.random() < 0.5;

// Generate random skills for a user
const generateRandomSkills = (count = 5) => {
  const skills = [];
  const usedSkills = new Set(); // Prevent duplicates
  
  while (skills.length < count && usedSkills.size < Object.values(SKILLS_BY_CATEGORY).flat().length) {
    const category = getRandomElement(SKILL_CATEGORIES);
    const categorySkills = SKILLS_BY_CATEGORY[category];
    const skill = getRandomElement(categorySkills);
    
    if (!usedSkills.has(skill)) {
      usedSkills.add(skill);
      skills.push({
        name: skill,
        category: category,
        level: getRandomNumber(1, 5),
        description: `Experienced in ${skill}`,
        hourlyRate: getRandomNumber(25, 150),
        verified: getRandomBoolean()
      });
    }
  }
  
  return skills;
};

// Generate random skills wanted for a user
const generateRandomSkillsWanted = (count = 3) => {
  const skillsWanted = [];
  const usedSkills = new Set();
  
  while (skillsWanted.length < count && usedSkills.size < Object.values(SKILLS_BY_CATEGORY).flat().length) {
    const category = getRandomElement(SKILL_CATEGORIES);
    const categorySkills = SKILLS_BY_CATEGORY[category];
    const skill = getRandomElement(categorySkills);
    
    if (!usedSkills.has(skill)) {
      usedSkills.add(skill);
      skillsWanted.push({
        name: skill,
        category: category,
        level: getRandomElement(['Beginner', 'Intermediate', 'Advanced']),
        description: `Looking to learn ${skill}`
      });
    }
  }
  
  return skillsWanted;
};

// Generate random availability
const generateRandomAvailability = () => {
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const availability = {};
  days.forEach(day => {
    availability[day] = getRandomBoolean();
  });
  return availability;
};

// Connect to database
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/skillswap-hub', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Clear existing data
const clearDatabase = async () => {
  try {
    await User.deleteMany({});
    await Match.deleteMany({});
    await Transaction.deleteMany({});
    await Message.deleteMany({});
    await Notification.deleteMany({});
    console.log('Database cleared successfully');
  } catch (error) {
    console.error('Error clearing database:', error);
  }
};

// Create dummy users
const createDummyUsers = async () => {
  try {
    console.log('Creating dummy users...');
    const users = [];
    
    for (const userData of SAMPLE_USERS) {
      // Create user without password first to avoid double hashing
      const user = new User({
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        password: 'password123', // Let the pre-save middleware handle hashing
        avatar: userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.firstName + ' ' + userData.lastName)}&background=random&color=fff&size=150`,
        bio: userData.bio,
        experience: userData.experience,
        location: { 
          city: userData.location,
          country: 'United States'
        },
        hourlyRate: userData.hourlyRate,
        website: userData.website,
        phone: `+1-555-${getRandomNumber(100, 999)}-${getRandomNumber(1000, 9999)}`,
        skills: generateRandomSkills(getRandomNumber(3, 7)),
        skillsWanted: generateRandomSkillsWanted(getRandomNumber(2, 4)),
        availability: generateRandomAvailability(),
        tokenBalance: getRandomNumber(150, 300),
        rating: {
          average: Math.round((Math.random() * 2 + 3) * 10) / 10, // Random rating between 3.0-5.0
          count: getRandomNumber(0, 50)
        },
        isActive: true,
        lastActive: new Date(Date.now() - getRandomNumber(0, 30) * 24 * 60 * 60 * 1000), // Random date within last month
        preferences: {
          notifications: {
            email: getRandomBoolean(),
            push: getRandomBoolean()
          },
          matchRadius: getRandomNumber(25, 100)
        }
      });
      
      await user.save();
      users.push(user);
    }
    
    console.log(`Created ${users.length} dummy users`);
    return users;
  } catch (error) {
    console.error('Error creating dummy users:', error);
    return [];
  }
};

// Generate session data for different scenarios
const generateSessionData = (requester, receiver, sessionType, sessionStatus = 'upcoming') => {
  const now = new Date();
  let startTime, endTime;
  
  switch (sessionStatus) {
    case 'upcoming':
      startTime = new Date(now.getTime() + getRandomNumber(1, 14) * 24 * 60 * 60 * 1000); // 1-14 days from now
      break;
    case 'in-progress':
      startTime = new Date(now.getTime() - getRandomNumber(0, 2) * 60 * 60 * 1000); // Started 0-2 hours ago
      break;
    case 'completed':
      startTime = new Date(now.getTime() - getRandomNumber(1, 30) * 24 * 60 * 60 * 1000); // 1-30 days ago
      break;
    case 'missed':
      startTime = new Date(now.getTime() - getRandomNumber(1, 7) * 24 * 60 * 60 * 1000); // 1-7 days ago
      break;
    default:
      startTime = new Date(now.getTime() + getRandomNumber(1, 14) * 24 * 60 * 60 * 1000);
  }
  
  // Set session time to business hours
  startTime.setHours(getRandomNumber(9, 17), getRandomNumber(0, 3) * 15, 0, 0);
  
  endTime = new Date(startTime);
  endTime.setHours(endTime.getHours() + getRandomNumber(1, 3)); // 1-3 hour sessions
  
  const sessionData = {
    startTime,
    endTime,
    type: sessionType,
    location: sessionType === 'online' 
      ? getRandomElement(['Zoom Meeting', 'Google Meet', 'Microsoft Teams', 'Skype']) 
      : getRandomElement(['Local Coffee Shop', 'Public Library', 'Co-working Space', 'University Campus']),
    status: sessionStatus,
    reminderSent: sessionStatus !== 'upcoming' || Math.random() > 0.3, // Most non-upcoming have reminders sent
    attendance: new Map(),
    paymentProcessed: false
  };

  // Add attendance data for past sessions
  if (['completed', 'missed'].includes(sessionStatus)) {
    const requesterAttended = sessionStatus === 'completed' ? Math.random() > 0.1 : Math.random() > 0.7; // 90% attend completed, 30% attend missed
    const receiverAttended = sessionStatus === 'completed' ? Math.random() > 0.1 : Math.random() > 0.7;
    
    sessionData.attendance.set(requester._id.toString(), {
      attended: requesterAttended,
      markedAt: new Date(endTime.getTime() + getRandomNumber(10, 120) * 60 * 1000), // Marked 10-120 min after session
      feedback: requesterAttended ? getRandomElement([
        'Great session, very helpful!',
        'Learned a lot, thanks!',
        'Excellent teaching style',
        'Clear explanations and good examples',
        'Very patient and knowledgeable'
      ]) : 'Had to cancel last minute'
    });
    
    sessionData.attendance.set(receiver._id.toString(), {
      attended: receiverAttended,
      markedAt: new Date(endTime.getTime() + getRandomNumber(10, 120) * 60 * 1000),
      feedback: receiverAttended ? getRandomElement([
        'Enjoyed the learning experience',
        'Good session, would recommend',
        'Very interactive and engaging',
        'Helpful and well-structured',
        'Great teacher, clear communication'
      ]) : 'Unable to attend due to emergency'
    });

    // Process payment if both attended (but leave some unpaid for testing)
    if (requesterAttended && receiverAttended && Math.random() > 0.5) {
      sessionData.paymentProcessed = true;
    }
  }

  // Add session-specific ratings for completed sessions with both attendance
  if (sessionStatus === 'completed' && sessionData.attendance.get(requester._id.toString())?.attended && sessionData.attendance.get(receiver._id.toString())?.attended) {
    sessionData.sessionRating = {
      requesterRating: Math.random() > 0.2 ? {
        score: getRandomNumber(3, 5), // Most ratings are positive
        comment: getRandomElement([
          'Excellent session! Very knowledgeable and patient teacher.',
          'Great learning experience, highly recommend.',
          'Clear explanations and good examples provided.',
          'Very helpful session, learned exactly what I needed.',
          'Professional and well-prepared instructor.'
        ]),
        submittedAt: new Date(endTime.getTime() + getRandomNumber(1, 48) * 60 * 60 * 1000) // 1-48 hours after session
      } : undefined,
      receiverRating: Math.random() > 0.2 ? {
        score: getRandomNumber(3, 5),
        comment: getRandomElement([
          'Great student, came prepared and asked good questions.',
          'Engaged learner, pleasure to teach.',
          'Very attentive and eager to learn.',
          'Asked thoughtful questions and practiced well.',
          'Respectful and punctual student.'
        ]),
        submittedAt: new Date(endTime.getTime() + getRandomNumber(1, 48) * 60 * 60 * 1000)
      } : undefined
    };
  }

  return sessionData;
};

// Create dummy matches with comprehensive session management data
const createDummyMatches = async (users) => {
  try {
    console.log('Creating dummy matches with session management data...');
    const matches = [];
    const createdMatches = new Set(); // Track unique combinations
    
    let attempts = 0;
    const maxAttempts = 60;
    
    // Define session distribution for realistic testing
    const sessionDistribution = [
      { status: 'upcoming', weight: 0.3 },    // 30% upcoming sessions
      { status: 'completed', weight: 0.4 },   // 40% completed sessions
      { status: 'missed', weight: 0.1 },      // 10% missed sessions
      { status: 'in-progress', weight: 0.05 }, // 5% in-progress sessions
      { status: null, weight: 0.15 }          // 15% without sessions (just matches)
    ];
    
    while (matches.length < 45 && attempts < maxAttempts) {
      attempts++;
      
      const requester = getRandomElement(users);
      const receiver = getRandomElement(users.filter(u => u._id.toString() !== requester._id.toString()));
      
      if (!requester.skills.length || !receiver.skills.length) continue;
      
      const requesterSkill = getRandomElement(requester.skills);
      const receiverSkill = getRandomElement(receiver.skills);
      
      // Create unique match identifier
      const matchKey = `${requester._id}-${receiver._id}-${requesterSkill.name}`;
      
      if (createdMatches.has(matchKey)) continue;
      
      try {
        const sessionType = getRandomElement(['online', 'in-person']);
        
        // Determine match status - more accepted matches for session testing
        const matchStatus = getRandomElement(['pending', 'accepted', 'accepted', 'accepted', 'rejected', 'completed']);
        
        const match = new Match({
          requester: requester._id,
          receiver: receiver._id,
          skillOffered: {
            name: requesterSkill.name,
            category: requesterSkill.category,
            description: `${requesterSkill.name} tutoring and guidance`,
            hourlyRate: requester.hourlyRate
          },
          skillRequested: {
            name: receiverSkill.name,
            category: receiverSkill.category,
            description: `Learn ${receiverSkill.name} fundamentals`
          },
          status: matchStatus,
          message: `Hi! I'd love to learn ${receiverSkill.name} from you. In exchange, I can teach you ${requesterSkill.name}.`,
          matchScore: getRandomNumber(60, 95)
        });

        // Add scheduled sessions for accepted matches
        if (matchStatus === 'accepted') {
          // Determine session status based on distribution
          const random = Math.random();
          let cumulativeWeight = 0;
          let sessionStatus = null;
          
          for (const { status, weight } of sessionDistribution) {
            cumulativeWeight += weight;
            if (random <= cumulativeWeight) {
              sessionStatus = status;
              break;
            }
          }
          
          if (sessionStatus) {
            match.scheduledSession = generateSessionData(requester, receiver, sessionType, sessionStatus);
          }
        }

        // Add basic ratings for completed matches (separate from session ratings)
        if (matchStatus === 'completed' && Math.random() > 0.3) {
          match.rating = {
            requesterRating: {
              score: getRandomNumber(3, 5),
              comment: 'Great skill exchange experience overall!'
            },
            receiverRating: {
              score: getRandomNumber(3, 5),
              comment: 'Enjoyed working together on this skill exchange.'
            }
          };
        }
        
        await match.save();
        matches.push(match);
        createdMatches.add(matchKey);
        
      } catch (error) {
        if (error.code === 11000) {
          // Duplicate key error, continue to next iteration
          continue;
        }
        throw error;
      }
    }
    
    // Log session statistics
    const sessionStats = {
      upcoming: 0,
      'in-progress': 0,
      completed: 0,
      missed: 0,
      cancelled: 0,
      noSession: 0
    };
    
    matches.forEach(match => {
      if (match.scheduledSession) {
        sessionStats[match.scheduledSession.status] = (sessionStats[match.scheduledSession.status] || 0) + 1;
      } else {
        sessionStats.noSession++;
      }
    });
    
    console.log(`Created ${matches.length} dummy matches with sessions:`);
    console.log(`  📅 Upcoming: ${sessionStats.upcoming}`);
    console.log(`  ⏳ In-Progress: ${sessionStats['in-progress']}`);
    console.log(`  ✅ Completed: ${sessionStats.completed}`);
    console.log(`  ❌ Missed: ${sessionStats.missed}`);
    console.log(`  🚫 No Session: ${sessionStats.noSession}`);
    
    return matches;
  } catch (error) {
    console.error('Error creating dummy matches:', error);
    return [];
  }
};

// Create dummy transactions including session payments
const createDummyTransactions = async (users, matches) => {
  try {
    console.log('Creating dummy transactions including session payments...');
    const transactions = [];
    
    // Create session-related transactions for completed sessions with payment processed
    const completedSessions = matches.filter(match => 
      match.scheduledSession?.status === 'completed' && 
      match.scheduledSession?.paymentProcessed
    );
    
    for (const match of completedSessions) {
      // Only create payment if both users attended (matching new payment logic)
      const requesterAttended = match.scheduledSession.attendance.get(match.requester._id.toString())?.attended;
      const receiverAttended = match.scheduledSession.attendance.get(match.receiver._id.toString())?.attended;
      
      if (!requesterAttended || !receiverAttended) {
        continue; // Skip payment if either user didn't attend
      }
      
      // Calculate session duration in minutes
      const duration = Math.round((match.scheduledSession.endTime - match.scheduledSession.startTime) / (1000 * 60));
      const hourlyRate = match.skillOffered.hourlyRate || 50;
      const amount = Math.min(Math.ceil((duration / 60) * hourlyRate), 200); // Cap at 200 tokens (matching new system)
      
      const transaction = new Transaction({
        from: match.receiver._id, // Learner pays teacher (use ObjectId)
        to: match.requester._id,  // Teacher receives payment (use ObjectId)
        amount: amount,
        type: 'session_payment',
        status: 'completed',
        description: `Automatic payment for completed ${match.skillOffered.name} session`,
        relatedMatch: match._id,
        metadata: {
          skillName: match.skillOffered.name,
          sessionDuration: duration,
          sessionDate: match.scheduledSession.startTime,
          sessionType: match.scheduledSession.type,
          automatic: true
        }
      });
      
      await transaction.save();
      transactions.push(transaction);
    }
    
    // Create additional general transactions
    for (let i = 0; i < 20; i++) {
      const from = getRandomElement(users);
      const to = getRandomElement(users.filter(u => u._id.toString() !== from._id.toString()));
      
      // Get current user balance to ensure we don't go negative
      const fromUser = await User.findById(from._id);
      const maxAmount = Math.min(fromUser.tokenBalance - 10, 100); // Leave at least 10 tokens
      const amount = getRandomNumber(5, Math.max(5, Math.min(maxAmount, 50))); // Lower amounts
      
      const transactionTypes = [
        { type: 'skill_exchange', weight: 0.4 },
        { type: 'bonus', weight: 0.2 },
        { type: 'refund', weight: 0.15 },
        { type: 'admin_adjustment', weight: 0.1 },
        { type: 'signup_bonus', weight: 0.15 }
      ];
      
      const transactionType = getRandomElement(transactionTypes.flatMap(t => 
        Array(Math.floor(t.weight * 10)).fill(t.type)
      ));
      
      const skillNames = Object.values(SKILLS_BY_CATEGORY).flat();
      
      // For system-generated transactions, use the first user as system account
      const systemUser = users[0]; // Use first user as system account for bonuses
      
      const transaction = new Transaction({
        from: transactionType === 'bonus' || transactionType === 'signup_bonus' || transactionType === 'admin_adjustment' 
          ? systemUser._id : from._id,
        to: to._id,
        amount: amount,
        type: transactionType,
        status: getRandomElement(['pending', 'completed', 'completed', 'completed', 'failed']), // Most completed
        description: transactionType === 'session_payment' 
          ? `Payment for ${getRandomElement(skillNames)} session`
          : transactionType === 'bonus'
          ? 'Monthly activity bonus'
          : transactionType === 'signup_bonus'
          ? 'Welcome bonus for new users'
          : transactionType === 'refund'
          ? 'Refund for cancelled session'
          : `Payment for ${getRandomElement(['web development', 'graphic design', 'tutoring', 'consulting', 'writing'])} services`,
        metadata: {
          skillName: getRandomElement(skillNames),
          sessionDuration: getRandomNumber(60, 180),
          sessionDate: new Date(Date.now() - getRandomNumber(0, 30) * 24 * 60 * 60 * 1000),
          automated: transactionType === 'session_payment'
        }
      });
      
      await transaction.save();
      transactions.push(transaction);
    }
    
    console.log(`Created ${transactions.length} dummy transactions:`);
    console.log(`  💰 Session Payments: ${transactions.filter(t => t.type === 'session_payment').length}`);
    console.log(`  🎁 Bonuses: ${transactions.filter(t => t.type === 'bonus' || t.type === 'signup_bonus').length}`);
    console.log(`  🔄 Other: ${transactions.filter(t => !['session_payment', 'bonus', 'signup_bonus'].includes(t.type)).length}`);
    
    return transactions;
  } catch (error) {
    console.error('Error creating dummy transactions:', error);
    return [];
  }
};

// Create dummy messages
const createDummyMessages = async (users, matches) => {
  try {
    console.log('Creating dummy messages...');
    const messages = [];
    
    // Only create messages for matches that exist
    if (matches.length === 0) {
      console.log('No matches found, skipping message creation');
      return messages;
    }
    
    // Create messages for each match
    const matchesToMessage = matches.slice(0, Math.min(10, matches.length));
    
    for (const match of matchesToMessage) {
      const messageCount = getRandomNumber(3, 7);
      for (let j = 0; j < messageCount; j++) {
        const isFromRequester = j % 2 === 0;
        const message = new Message({
          match: match._id,
          sender: isFromRequester ? match.requester : match.receiver,
          receiver: isFromRequester ? match.receiver : match.requester,
          content: getRandomElement([
            "Hi! I'm interested in learning more about your skills.",
            "That sounds great! When would be a good time to discuss?",
            "I'm available this weekend. How about Saturday afternoon?",
            "Perfect! Let's meet at 2 PM. I'll send you the details.",
            "Thank you for the great session! I learned a lot.",
            "You're welcome! Feel free to reach out anytime.",
            "I'd love to continue our skill exchange. Are you free next week?"
          ]),
          type: 'text',
          readBy: getRandomBoolean() ? [{
            user: isFromRequester ? match.receiver : match.requester,
            readAt: new Date(Date.now() - getRandomNumber(0, 5) * 60 * 60 * 1000)
          }] : []
        });
        
        await message.save();
        messages.push(message);
      }
    }
    
    console.log(`Created ${messages.length} dummy messages`);
    return messages;
  } catch (error) {
    console.error('Error creating dummy messages:', error);
    return [];
  }
};

// Create dummy notifications including session-related ones
const createDummyNotifications = async (users, matches) => {
  try {
    console.log('Creating dummy notifications including session-related ones...');
    const notifications = [];
    
    // Create session-related notifications
    const sessionsWithNotifications = matches.filter(match => match.scheduledSession);
    
    for (const match of sessionsWithNotifications.slice(0, 15)) { // Limit to prevent too many notifications
      const participants = [match.requester, match.receiver];
      
      for (const participantId of participants) {
        const otherParticipant = participants.find(p => p.toString() !== participantId.toString());
        
        // Session scheduled notification
        const sessionScheduledNotif = new Notification({
          recipient: participantId,
          type: 'session_scheduled',
          title: 'Session Scheduled',
          message: `Your ${match.skillOffered.name} session has been scheduled for ${match.scheduledSession.startTime ? match.scheduledSession.startTime.toLocaleDateString() : 'TBD'}`,
          isRead: getRandomBoolean(),
          priority: 'medium',
          data: {
            matchId: match._id,
            sessionDate: match.scheduledSession.startTime,
            skillName: match.skillOffered.name
          },
          readAt: getRandomBoolean() ? new Date(Date.now() - getRandomNumber(0, 2) * 24 * 60 * 60 * 1000) : undefined
        });
        await sessionScheduledNotif.save();
        notifications.push(sessionScheduledNotif);
        
        // Session reminder notification (for upcoming/completed sessions)
        if (['upcoming', 'completed', 'missed'].includes(match.scheduledSession.status)) {
          const reminderNotif = new Notification({
            recipient: participantId,
            type: 'session_reminder',
            title: 'Session Reminder',
            message: `Reminder: Your ${match.skillOffered.name} session is ${match.scheduledSession.status === 'upcoming' ? 'tomorrow' : 'starting soon'}`,
            isRead: match.scheduledSession.status !== 'upcoming',
            priority: 'high',
            data: {
              matchId: match._id,
              sessionDate: match.scheduledSession.startTime,
              skillName: match.skillOffered.name
            },
            readAt: match.scheduledSession.status !== 'upcoming' 
              ? new Date(match.scheduledSession.startTime.getTime() - getRandomNumber(1, 24) * 60 * 60 * 1000) 
              : undefined
          });
          await reminderNotif.save();
          notifications.push(reminderNotif);
        }
        
        // Payment notifications for completed sessions
        if (match.scheduledSession.status === 'completed' && match.scheduledSession.paymentProcessed) {
          const isTeacher = participantId.toString() === match.requester.toString();
          const paymentNotif = new Notification({
            recipient: participantId,
            type: isTeacher ? 'payment_received' : 'session_payment',
            title: isTeacher ? 'Session Payment Received' : 'Session Payment Processed',
            message: isTeacher 
              ? `You received tokens for teaching ${match.skillOffered.name}` 
              : `Payment sent for your ${match.skillOffered.name} learning session`,
            isRead: getRandomBoolean(),
            priority: 'medium',
            data: {
              matchId: match._id,
              skillName: match.skillOffered.name,
              amount: Math.round(((match.scheduledSession.endTime - match.scheduledSession.startTime) / (1000 * 60 * 60)) * (match.skillOffered.hourlyRate || 50))
            },
            readAt: getRandomBoolean() ? new Date() : undefined
          });
          await paymentNotif.save();
          notifications.push(paymentNotif);
        }
      }
    }
    
    // Create general notifications
    for (let i = 0; i < 30; i++) {
      const user = getRandomElement(users);
      
      const notificationTypes = [
        {
          type: 'new_match',
          title: 'New Skill Match!',
          message: 'Someone wants to exchange skills with you!',
          priority: 'medium'
        },
        {
          type: 'match_accepted',
          title: 'Match Accepted',
          message: 'Your skill exchange request has been accepted!',
          priority: 'high'
        },
        {
          type: 'match_rejected',
          title: 'Match Update',
          message: 'A skill exchange request has been declined.',
          priority: 'low'
        },
        {
          type: 'new_message',
          title: 'New Message',
          message: 'You have received a new message from a skill partner.',
          priority: 'medium'
        },
        {
          type: 'payment_received',
          title: 'Payment Received',
          message: 'You have received tokens for your skill session!',
          priority: 'high'
        },
        {
          type: 'system_update',
          title: 'Welcome to SkillSwap Hub!',
          message: 'Start exploring and connecting with other skill enthusiasts.',
          priority: 'low'
        },
        {
          type: 'system_update',
          title: 'Profile Viewed',
          message: 'Someone viewed your profile and is interested in your skills!',
          priority: 'low'
        },
        {
          type: 'rating_received',
          title: 'Skill Endorsed',
          message: 'Someone endorsed your skills! Your profile credibility has increased.',
          priority: 'medium'
        }
      ];
      
      const notificationData = getRandomElement(notificationTypes);
      
      const notification = new Notification({
        recipient: user._id,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        isRead: getRandomBoolean(),
        priority: notificationData.priority,
        readAt: getRandomBoolean() ? new Date(Date.now() - getRandomNumber(0, 5) * 24 * 60 * 60 * 1000) : undefined
      });
      
      await notification.save();
      notifications.push(notification);
    }
    
    const notificationStats = {
      session_scheduled: notifications.filter(n => n.type === 'session_scheduled').length,
      session_reminder: notifications.filter(n => n.type === 'session_reminder').length,
      payment_received: notifications.filter(n => n.type === 'payment_received').length,
      session_payment: notifications.filter(n => n.type === 'session_payment').length,
      other: notifications.filter(n => !['session_scheduled', 'session_reminder', 'payment_received', 'session_payment'].includes(n.type)).length
    };
    
    console.log(`Created ${notifications.length} dummy notifications:`);
    console.log(`  📅 Session Scheduled: ${notificationStats.session_scheduled}`);
    console.log(`  ⏰ Session Reminders: ${notificationStats.session_reminder}`);
    console.log(`  💰 Payment Related: ${notificationStats.payment_received + notificationStats.session_payment}`);
    console.log(`  📬 Other: ${notificationStats.other}`);
    
    return notifications;
  } catch (error) {
    console.error('Error creating dummy notifications:', error);
    return [];
  }
};

// Main seeding function
const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');
    
    await connectDB();
    
    // Clear existing data
    await clearDatabase();
    
    // Create dummy data
    const users = await createDummyUsers();
    if (users.length === 0) {
      console.error('No users created, skipping other data creation');
      return;
    }
    
    const matches = await createDummyMatches(users);
    const transactions = await createDummyTransactions(users, matches);
    const messages = await createDummyMessages(users, matches);
    const notifications = await createDummyNotifications(users, matches);
    
    console.log('\n✅ Database seeding completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   Users: ${users.length}`);
    console.log(`   Matches: ${matches.length}`);
    console.log(`   Transactions: ${transactions.length}`);
    console.log(`   Messages: ${messages.length}`);
    console.log(`   Notifications: ${notifications.length}`);
    
    // Session Management Statistics
    const sessionStats = {
      scheduled: matches.filter(m => m.scheduledSession).length,
      upcoming: matches.filter(m => m.scheduledSession?.status === 'upcoming').length,
      completed: matches.filter(m => m.scheduledSession?.status === 'completed').length,
      missed: matches.filter(m => m.scheduledSession?.status === 'missed').length,
      inProgress: matches.filter(m => m.scheduledSession?.status === 'in-progress').length,
      withRatings: matches.filter(m => m.scheduledSession?.sessionRating?.requesterRating || m.scheduledSession?.sessionRating?.receiverRating).length,
      paymentsProcessed: matches.filter(m => m.scheduledSession?.paymentProcessed).length
    };
    
    console.log(`\n🎯 Session Management Features:`);
    console.log(`   📅 Total Scheduled Sessions: ${sessionStats.scheduled}`);
    console.log(`   ⏳ Upcoming Sessions: ${sessionStats.upcoming}`);
    console.log(`   ✅ Completed Sessions: ${sessionStats.completed}`);
    console.log(`   ❌ Missed Sessions: ${sessionStats.missed}`);
    console.log(`   🔄 In-Progress Sessions: ${sessionStats.inProgress}`);
    console.log(`   ⭐ Sessions with Ratings: ${sessionStats.withRatings}`);
    console.log(`   💰 Payments Processed: ${sessionStats.paymentsProcessed}`);
    
    console.log('\n📝 Test credentials:');
    console.log('   Email: alice.johnson@example.com');
    console.log('   Password: password123');
    console.log('   (All users have the same password for testing)');
    
    console.log('\n🧪 Session Management Testing:');
    console.log('   - Visit /sessions to see the session dashboard');
    console.log('   - Test attendance marking for completed sessions');
    console.log('   - Test session rating functionality');
    console.log('   - Test payment processing for attended sessions');
    console.log('   - Check automated reminders and status updates');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    process.exit(0);
  }
};

// Run the seeding if this file is executed directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };