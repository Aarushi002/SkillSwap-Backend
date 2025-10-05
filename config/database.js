const mongoose = require('mongoose');

/**
 * MongoDB Atlas Connection Configuration
 */
class DatabaseConnection {
  static async connect() {
    try {
      const mongoUri = process.env.MONGODB_URI;
      
      if (!mongoUri) {
        throw new Error('MONGODB_URI environment variable is not defined');
      }

      // Connection options optimized for MongoDB Atlas
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10, // Maintain up to 10 socket connections
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
        family: 4, // Use IPv4, skip trying IPv6
      };

      // Connect to MongoDB Atlas
      await mongoose.connect(mongoUri, options);

      console.log('✅ Connected to MongoDB Atlas successfully');
      
      // Log connection details (without sensitive info)
      const connection = mongoose.connection;
      console.log(`📊 Database: ${connection.db.databaseName}`);
      console.log(`🌐 Host: ${connection.host}`);
      console.log(`📡 Ready State: ${connection.readyState}`);

    } catch (error) {
      console.error('❌ MongoDB Atlas connection error:', error.message);
      
      // Enhanced error handling for common Atlas connection issues
      if (error.message.includes('authentication failed')) {
        console.error('🔐 Authentication failed. Please check your username and password.');
      } else if (error.message.includes('connection refused')) {
        console.error('🔗 Connection refused. Please check your network whitelist in MongoDB Atlas.');
      } else if (error.message.includes('ENOTFOUND')) {
        console.error('🌍 DNS lookup failed. Please check your cluster URL.');
      }
      
      process.exit(1);
    }
  }

  static setupEventHandlers() {
    const connection = mongoose.connection;

    connection.on('connected', () => {
      console.log('🔗 Mongoose connected to MongoDB Atlas');
    });

    connection.on('error', (err) => {
      console.error('❌ Mongoose connection error:', err);
    });

    connection.on('disconnected', () => {
      console.log('🔌 Mongoose disconnected from MongoDB Atlas');
    });

    // Handle application termination
    process.on('SIGINT', async () => {
      try {
        await connection.close();
        console.log('📴 MongoDB Atlas connection closed through app termination');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error closing MongoDB connection:', error);
        process.exit(1);
      }
    });
  }

  static getConnectionStatus() {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    return {
      state: states[mongoose.connection.readyState],
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };
  }
}

module.exports = DatabaseConnection;