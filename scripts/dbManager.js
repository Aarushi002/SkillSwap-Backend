#!/usr/bin/env node

/**
 * Database Management Script
 * Provides utilities for managing MongoDB Atlas database
 */

require('dotenv').config();
const mongoose = require('mongoose');
const DatabaseConnection = require('../config/database');

// Import models
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Message = require('../models/Message');
const Match = require('../models/Match');
const Notification = require('../models/Notification');

class DatabaseManager {
  static async connect() {
    try {
      await DatabaseConnection.connect();
      console.log('✅ Connected to database');
    } catch (error) {
      console.error('❌ Failed to connect to database:', error.message);
      process.exit(1);
    }
  }

  static async disconnect() {
    try {
      await mongoose.connection.close();
      console.log('📴 Disconnected from database');
    } catch (error) {
      console.error('❌ Error disconnecting from database:', error.message);
    }
  }

  static async getStats() {
    try {
      const stats = await Promise.all([
        User.countDocuments(),
        Transaction.countDocuments(),
        Message.countDocuments(),
        Match.countDocuments(),
        Notification.countDocuments()
      ]);

      const [userCount, transactionCount, messageCount, matchCount, notificationCount] = stats;

      console.log('\n📊 Database Statistics:');
      console.log(`👥 Users: ${userCount}`);
      console.log(`💰 Transactions: ${transactionCount}`);
      console.log(`💬 Messages: ${messageCount}`);
      console.log(`🤝 Matches: ${matchCount}`);
      console.log(`🔔 Notifications: ${notificationCount}`);
      console.log(`📈 Total Documents: ${stats.reduce((a, b) => a + b, 0)}`);

      return {
        users: userCount,
        transactions: transactionCount,
        messages: messageCount,
        matches: matchCount,
        notifications: notificationCount,
        total: stats.reduce((a, b) => a + b, 0)
      };
    } catch (error) {
      console.error('❌ Error getting database statistics:', error.message);
      throw error;
    }
  }

  static async checkHealth() {
    try {
      const dbStatus = DatabaseConnection.getConnectionStatus();
      const isConnected = dbStatus.state === 'connected';
      
      console.log('\n🏥 Database Health Check:');
      console.log(`🔗 Connection State: ${dbStatus.state}`);
      console.log(`🌐 Host: ${dbStatus.host || 'N/A'}`);
      console.log(`📛 Database Name: ${dbStatus.name || 'N/A'}`);
      console.log(`✅ Status: ${isConnected ? 'Healthy' : 'Unhealthy'}`);

      if (isConnected) {
        // Test a simple query
        await User.findOne().limit(1);
        console.log('🧪 Query Test: Passed');
      }

      return { healthy: isConnected, status: dbStatus };
    } catch (error) {
      console.error('❌ Database health check failed:', error.message);
      return { healthy: false, error: error.message };
    }
  }

  static async createIndexes() {
    try {
      console.log('🔧 Creating database indexes...');
      
      // User indexes
      await User.createIndexes();
      console.log('✅ User indexes created');

      // Transaction indexes
      await Transaction.createIndexes();
      console.log('✅ Transaction indexes created');

      // Message indexes
      await Message.createIndexes();
      console.log('✅ Message indexes created');

      // Match indexes
      await Match.createIndexes();
      console.log('✅ Match indexes created');

      // Notification indexes
      await Notification.createIndexes();
      console.log('✅ Notification indexes created');

      console.log('🎉 All indexes created successfully');
    } catch (error) {
      console.error('❌ Error creating indexes:', error.message);
      throw error;
    }
  }

  static async clearDatabase() {
    try {
      console.log('⚠️  WARNING: This will delete ALL data in the database!');
      console.log('This action cannot be undone.');
      
      // In a real scenario, you might want to add a confirmation prompt
      // For now, we'll just proceed with the operation
      
      await User.deleteMany({});
      await Transaction.deleteMany({});
      await Message.deleteMany({});
      await Match.deleteMany({});
      await Notification.deleteMany({});

      console.log('🗑️  Database cleared successfully');
    } catch (error) {
      console.error('❌ Error clearing database:', error.message);
      throw error;
    }
  }
}

// Command line interface
async function main() {
  const command = process.argv[2];

  if (!command) {
    console.log(`
🛠️  Database Management Tool

Usage: node dbManager.js <command>

Commands:
  stats     - Show database statistics
  health    - Check database health
  indexes   - Create database indexes
  clear     - Clear all data (USE WITH CAUTION!)
  
Examples:
  node scripts/dbManager.js stats
  node scripts/dbManager.js health
  node scripts/dbManager.js indexes
    `);
    return;
  }

  await DatabaseManager.connect();

  try {
    switch (command.toLowerCase()) {
      case 'stats':
        await DatabaseManager.getStats();
        break;
      
      case 'health':
        await DatabaseManager.checkHealth();
        break;
      
      case 'indexes':
        await DatabaseManager.createIndexes();
        break;
      
      case 'clear':
        await DatabaseManager.clearDatabase();
        break;
      
      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('Use "node dbManager.js" without arguments to see available commands.');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Command failed:', error.message);
    process.exit(1);
  } finally {
    await DatabaseManager.disconnect();
  }
}

// Export for use in other scripts
module.exports = DatabaseManager;

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
}