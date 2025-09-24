const mongoose = require('mongoose');
const User = require('../models/User');
const Match = require('../models/Match');
const Transaction = require('../models/Transaction');
const Message = require('../models/Message');
const Notification = require('../models/Notification');
require('dotenv').config();

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

// Clear all data from database
const clearDatabase = async () => {
  try {
    console.log('🧹 Clearing database...');
    
    await connectDB();
    
    const results = await Promise.all([
      User.deleteMany({}),
      Match.deleteMany({}),
      Transaction.deleteMany({}),
      Message.deleteMany({}),
      Notification.deleteMany({})
    ]);
    
    console.log('✅ Database cleared successfully!');
    console.log(`📊 Deleted:`);
    console.log(`   Users: ${results[0].deletedCount}`);
    console.log(`   Matches: ${results[1].deletedCount}`);
    console.log(`   Transactions: ${results[2].deletedCount}`);
    console.log(`   Messages: ${results[3].deletedCount}`);
    console.log(`   Notifications: ${results[4].deletedCount}`);
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
  } finally {
    process.exit(0);
  }
};

// Run if this file is executed directly
if (require.main === module) {
  clearDatabase();
}

module.exports = { clearDatabase };