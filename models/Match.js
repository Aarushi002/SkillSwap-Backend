const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  requester: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  skillOffered: {
    name: String,
    category: String,
    description: String,
    hourlyRate: Number
  },
  skillRequested: {
    name: String,
    category: String,
    description: String
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'completed', 'cancelled'],
    default: 'pending'
  },
  matchScore: {
    type: Number,
    min: 0,
    max: 100
  },
  message: {
    type: String,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  scheduledSession: {
    startTime: Date,
    endTime: Date,
    location: String,
    type: {
      type: String,
      enum: ['online', 'in-person'],
      default: 'online'
    },
    status: {
      type: String,
      enum: ['upcoming', 'in-progress', 'completed', 'missed', 'cancelled', 'partial'],
      default: 'upcoming'
    },
    reminderSent: {
      type: Boolean,
      default: false
    },
    attendance: {
      type: Map,
      of: {
        attended: Boolean,
        markedAt: Date,
        feedback: String
      }
    },
    paymentProcessed: {
      type: Boolean,
      default: false
    },
    sessionRating: {
      requesterRating: {
        score: { type: Number, min: 1, max: 5 },
        comment: { type: String, maxlength: 500 },
        submittedAt: { type: Date }
      },
      receiverRating: {
        score: { type: Number, min: 1, max: 5 },
        comment: { type: String, maxlength: 500 },
        submittedAt: { type: Date }
      }
    }
  },
  rating: {
    requesterRating: {
      score: {
        type: Number,
        min: 1,
        max: 5
      },
      comment: String
    },
    receiverRating: {
      score: {
        type: Number,
        min: 1,
        max: 5
      },
      comment: String
    }
  }
}, {
  timestamps: true
});

// Compound index to prevent duplicate matches
matchSchema.index({ requester: 1, receiver: 1, 'skillOffered.name': 1 }, { unique: true });

// Index for efficient querying
matchSchema.index({ requester: 1, status: 1 });
matchSchema.index({ receiver: 1, status: 1 });
matchSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Match', matchSchema);
