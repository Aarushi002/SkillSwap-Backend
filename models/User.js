const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  avatar: {
    type: String,
    default: ''
  },
  phone: {
    type: String,
    default: ''
  },
  website: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    maxlength: [2000, 'Bio cannot exceed 2000 characters']
  },
  experience: {
    type: String,
    maxlength: [2000, 'Experience cannot exceed 2000 characters']
  },
  hourlyRate: {
    type: Number,
    default: 0,
    min: 0
  },
  location: {
    city: String,
    country: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  skills: [{
    name: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true,
      enum: [
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
      ]
    },
    level: {
      type: Number,
      required: true,
      enum: [1, 2, 3, 4, 5],
      min: 1,
      max: 5
    },
    description: String,
    hourlyRate: {
      type: Number,
      default: 0
    },
    verified: {
      type: Boolean,
      default: false
    }
  }],
  skillsWanted: [{
    name: String,
    category: String,
    level: String,
    description: String
  }],
  tokenBalance: {
    type: Number,
    default: 100, // Starting balance
    min: 0
  },
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  availability: {
    monday: {
      type: Boolean,
      default: false
    },
    tuesday: {
      type: Boolean,
      default: false
    },
    wednesday: {
      type: Boolean,
      default: false
    },
    thursday: {
      type: Boolean,
      default: false
    },
    friday: {
      type: Boolean,
      default: false
    },
    saturday: {
      type: Boolean,
      default: false
    },
    sunday: {
      type: Boolean,
      default: false
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  preferences: {
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      }
    },
    matchRadius: {
      type: Number,
      default: 50 // km
    }
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for location-based queries
userSchema.index({ "location.coordinates": "2dsphere" });

// Password hashing middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Password comparison method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Calculate user rating
userSchema.methods.updateRating = function(newRating) {
  const totalRating = (this.rating.average * this.rating.count) + newRating;
  this.rating.count += 1;
  this.rating.average = totalRating / this.rating.count;
};

module.exports = mongoose.model('User', userSchema);
