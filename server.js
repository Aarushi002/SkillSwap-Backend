const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const morgan = require('morgan');
const { createServer } = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import database configuration
const DatabaseConnection = require('./config/database');

const app = express();
const server = createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

// Rate limiting - more lenient for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // 1000 requests for development, 100 for production
  message: 'Too many requests from this IP, please try again later.',
  skipSuccessfulRequests: false,
  skip: (req, res) => {
    // Skip rate limiting for health checks and static files
    return req.path === '/api/health' || req.path.startsWith('/uploads/');
  }
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // Cache preflight request for 24 hours
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API endpoint to serve images with proper CORS headers
app.get('/uploads/avatars/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', 'avatars', filename);
  
  console.log(`[IMAGE API] Serving ${filename} from ${filePath} - Origin: ${req.get('Origin')}`);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.log(`[IMAGE API] File not found: ${filePath}`);
    return res.status(404).json({ error: 'File not found' });
  }
  
  // Set comprehensive CORS headers for image loading
  res.header('Access-Control-Allow-Origin', '*'); // Allow all origins for images
  res.header('Access-Control-Allow-Credentials', 'false'); // Set to false when using wildcard origin
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  res.header('Access-Control-Max-Age', '86400');
  
  // Set content type based on file extension
  const ext = path.extname(filename).toLowerCase();
  const contentType = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  }[ext] || 'application/octet-stream';
  
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours cache
  res.setHeader('Accept-Ranges', 'bytes'); // Support for partial content requests
  
  console.log(`[IMAGE API] Sending file with content-type: ${contentType} and CORS headers`);
  
  // Send the file
  res.sendFile(filePath);
});

// Handle OPTIONS requests for uploads
app.options('/uploads/avatars/:filename', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Credentials', 'false');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma');
  res.header('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

// Database connection
async function initializeDatabase() {
  try {
    await DatabaseConnection.connect();
    DatabaseConnection.setupEventHandlers();
  } catch (error) {
    console.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

// Socket.io connection handling
const socketHandler = require('./socket/socketHandler');
socketHandler(io);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/skills', require('./routes/skills'));
app.use('/api/matches', require('./routes/matches'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/stats', require('./routes/stats'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = DatabaseConnection.getConnectionStatus();
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    database: dbStatus,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000; // Updated CORS for images

// Start session scheduler
const sessionScheduler = require('./services/sessionScheduler');

// Initialize application
async function startServer() {
  try {
    // Initialize database connection
    await initializeDatabase();
    
    // Start session scheduler
    sessionScheduler.start();
    
    // Start server
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log('📅 Session scheduler initialized');
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
startServer();

module.exports = { app, io };
