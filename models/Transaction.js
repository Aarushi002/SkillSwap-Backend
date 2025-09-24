const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  type: {
    type: String,
    enum: ['skill_exchange', 'session_payment', 'bonus', 'refund', 'admin_adjustment', 'signup_bonus'],
    required: true
  },
  description: {
    type: String,
    required: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  relatedMatch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Match'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  metadata: {
    skillName: String,
    sessionDuration: Number, // in minutes
    sessionDate: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
transactionSchema.index({ from: 1, createdAt: -1 });
transactionSchema.index({ to: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ relatedMatch: 1 });

// Pre-save middleware to handle token transfer
transactionSchema.pre('save', async function(next) {
  if (this.isNew && this.status === 'completed') {
    try {
      const User = mongoose.model('User');
      
      // Check if sender has enough balance
      const sender = await User.findById(this.from);
      if (sender.tokenBalance < this.amount) {
        return next(new Error(`Insufficient balance. Required: ${this.amount}, Available: ${sender.tokenBalance}`));
      }
      
      // Update balances atomically
      await User.findByIdAndUpdate(this.from, {
        $inc: { tokenBalance: -this.amount }
      });
      
      await User.findByIdAndUpdate(this.to, {
        $inc: { tokenBalance: this.amount }
      });
      
      next();
    } catch (error) {
      next(error);
    }
  } else {
    next();
  }
});

module.exports = mongoose.model('Transaction', transactionSchema);
