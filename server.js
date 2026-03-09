const express = require('express');
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
const isProduction = process.env.NODE_ENV === 'production';

// Create HTTP server only for local development
const server = createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Attach io to app in case routes need it
app.set('io', io);

// Middleware
app.use(helmet());
app.use(compression());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 1000,
  message: 'Too many requests from this IP, please try again later.',
  skipSuccessfulRequests: false,
  skip: (req) => {
    return req.path === '/api/health' || req.path.startsWith('/uploads/');
  },
});

app.use('/api/', limiter);

// CORS configuration
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://skill-swap-frontend-gray.vercel.app"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API endpoint to serve images with proper CORS headers
app.get('/uploads/avatars/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', 'avatars', filename);

  console.log(`[IMAGE API] Serving ${filename} from ${filePath} - Origin: ${req.get('Origin')}`);

  if (!fs.existsSync(filePath)) {
    console.log(`[IMAGE API] File not found: ${filePath}`);
    return res.status(404).json({ error: 'File not found' });
  }

  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Credentials', 'false');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma'
  );
  res.header('Access-Control-Max-Age', '86400');

  const ext = path.extname(filename).toLowerCase();
  const contentType =
    {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    }[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.setHeader('Accept-Ranges', 'bytes');

  console.log(`[IMAGE API] Sending file with content-type: ${contentType} and CORS headers`);

  res.sendFile(filePath);
});

// Handle OPTIONS requests for uploads
app.options('/uploads/avatars/:filename', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Credentials', 'false');
  res.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control, Pragma'
  );
  res.header('Access-Control-Max-Age', '86400');
  res.status(204).end();
});

// App init cache so serverless doesn't reconnect on every request
let initPromise = null;
let schedulerStarted = false;

async function initializeApp() {
  if (!initPromise) {
    initPromise = (async () => {
      await DatabaseConnection.connect();
      DatabaseConnection.setupEventHandlers();

      if (!isProduction) {
        const socketHandler = require('./socket/socketHandler');
        socketHandler(io);
      }

      if (!schedulerStarted) {
        const sessionScheduler = require('./services/sessionScheduler');
        sessionScheduler.start();
        schedulerStarted = true;
      }
    })().catch((error) => {
      initPromise = null;
      throw error;
    });
  }

  return initPromise;
}

// Ensure app is initialized before routes run
app.use(async (req, res, next) => {
  try {
    await initializeApp();
    next();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    res.status(500).json({
      message: 'Failed to initialize application',
      error: isProduction ? 'Internal server error' : error.message,
    });
  }
});

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
app.get('/api/health', async (req, res) => {
  try {
    await initializeApp();
    const dbStatus = DatabaseConnection.getConnectionStatus();

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      environment: process.env.NODE_ENV || 'development',
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      message: 'Health check failed',
      error: isProduction ? 'Internal server error' : error.message,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: isProduction ? 'Internal server error' : err.message,
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

// Start local server only outside production
if (!isProduction) {
  initializeApp()
    .then(() => {
      server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`Client URL: ${process.env.CLIENT_URL || 'http://localhost:3000'}`);
      });
    })
    .catch((error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });
}

// Export app for Vercel serverless
module.exports = app;
