import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { User } from './src/models/User.js';
import { File } from './src/models/File.js';
import { Annotation } from './src/models/Annotation.js';
import { connectDB } from './src/lib/db.js';
import annotationRoutes from './src/routes/annotationRoutes.js';

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const port = process.env.PORT || 3000;

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Attempt graceful shutdown
  shutdown(1);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
  // Attempt graceful shutdown
  shutdown(1);
});

// Basic Middleware Setup
const corsOptions = {
  origin: ['http://localhost:5173', process.env.CLIENT_URL, 'https://annotation-demo.onrender.com'].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Increase payload limits with error handling
app.use(express.json({ 
  limit: '50mb',
  verify: (req, res, buf) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase()) && buf.length > 0) {
      try {
        JSON.parse(buf);
      } catch (e) {
        res.status(400).json({ 
          error: 'Invalid JSON',
          details: 'The request contains invalid JSON data'
        });
        throw new Error('Invalid JSON');
      }
    }
  }
}));

app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware with error handling
app.use((req, res, next) => {
  try {
    const logData = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined
    };
    console.log('Request:', JSON.stringify(logData, null, 2));
    next();
  } catch (error) {
    console.error('Logging middleware error:', error);
    next(); // Continue even if logging fails
  }
});

// Auth Middleware Definition with better error handling
const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = await clerkClient.verifyToken(token);
      req.auth = {
        userId: decoded.sub,
        sessionId: decoded.sid,
        session: decoded
      };
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res.status(401).json({
        error: 'Invalid token',
        details: 'Unable to verify authentication token'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      error: 'Authentication failed',
      details: 'An error occurred during authentication'
    });
  }
};

const withUserSync = async (req, res, next) => {
  try {
    if (!req.auth?.userId) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'Authentication required'
      });
    }

    try {
      const clerkUser = await clerkClient.users.getUser(req.auth.userId);
      let user = await User.findOne({ clerkId: req.auth.userId });
      
      if (!user) {
        const userData = {
          clerkId: req.auth.userId,
          email: clerkUser.emailAddresses[0]?.emailAddress,
          firstName: clerkUser.firstName,
          lastName: clerkUser.lastName,
          createdAt: new Date(),
          lastLoginAt: new Date()
        };
        
        user = new User(userData);
        await user.save();
      } else {
        user.email = clerkUser.emailAddresses[0]?.emailAddress;
        user.firstName = clerkUser.firstName;
        user.lastName = clerkUser.lastName;
        user.lastLoginAt = new Date();
        await user.save();
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('User sync error:', error);
      return res.status(500).json({
        error: 'User synchronization failed',
        details: 'Unable to sync user data'
      });
    }
  } catch (error) {
    console.error('User sync middleware error:', error);
    res.status(500).json({
      error: 'User synchronization failed',
      details: 'An error occurred during user synchronization'
    });
  }
};

// Combined middleware
const authenticateAndSync = [requireAuth, withUserSync];

// Async handler wrapper to catch errors
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ---------- FILE ROUTES ----------
app.get('/api/files', authenticateAndSync, asyncHandler(async (req, res) => {
  const mongoUserId = req.user._id;
  const files = await File.find({ userId: mongoUserId }).lean();
  
  const processedFiles = files.map(file => ({
    ...file,
    metadata: {
      totalPapers: file.papers.length,
      totalEvents: file.papers.reduce((sum, paper) => 
        sum + (paper.events?.length || 0), 0)
    }
  }));

  res.json({
    success: true,
    files: processedFiles
  });
}));

app.get('/api/files/:fileId', authenticateAndSync, asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  const mongoUserId = req.user._id;

  const file = await File.findOne({ _id: fileId, userId: mongoUserId });

  if (!file) {
    return res.status(404).json({
      success: false,
      error: 'File not found'
    });
  }

  const fileObj = file.toObject();
  
  res.json({
    success: true,
    file: {
      ...fileObj,
      papers: fileObj.papers || [],  // Include papers inside file object
      uploadDate: fileObj.uploadDate,
      metadata: {
        totalPapers: fileObj.papers?.length || 0,
        totalEvents: fileObj.papers?.reduce((sum, paper) => 
          sum + (paper.events?.length || 0), 0) || 0
      }
    }
  });
}));

app.post('/api/files/upload', authenticateAndSync, asyncHandler(async (req, res) => {
  const { name, papers } = req.body;
  const mongoUserId = req.user._id;

  if (!name || !papers) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields',
      details: 'Name and papers are required'
    });
  }

  if (!Array.isArray(papers)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request format',
      details: 'Papers must be an array'
    });
  }

  const totalEvents = papers.reduce((sum, paper) => 
    sum + (paper.events?.length || 0), 0);

  const fileDoc = {
    userId: mongoUserId,
    name,
    papers,
    metadata: {
      totalPapers: papers.length,
      totalEvents
    }
  };

  const newFile = new File(fileDoc);
  const savedFile = await newFile.save();

  res.status(201).json({
    success: true,
    file: savedFile,
    message: 'File uploaded successfully'
  });
}));

app.delete('/api/files/:fileId', authenticateAndSync, asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  const mongoUserId = req.user._id;

  const file = await File.findOne({
    _id: fileId,
    userId: mongoUserId
  });

  if (!file) {
    return res.status(404).json({
      success: false,
      error: 'File not found',
      details: 'File does not exist or you do not have permission to delete it'
    });
  }

  await Promise.all([
    File.deleteOne({ _id: fileId }),
    Annotation.deleteMany({ fileId })
  ]);

  res.json({
    success: true,
    message: 'File and related annotations deleted successfully'
  });
}));

// Mount annotation routes with error boundary
// After mounting routes
app.use('/api/annotations', authenticateAndSync, annotationRoutes);

// Log all registered routes, including mounted routes
const listEndpoints = (app) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) { // routes registered directly on the app
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') { // router middleware
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: '/api/annotations' + handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  return routes;
};

console.log('All registered routes:', listEndpoints(app));

// Add route-specific error handler for annotations
app.use('/api/annotations', (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  console.error('Annotation route error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: 'Annotation processing failed',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// ---------- PRODUCTION SETUP ----------
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.get('*', (req, res) => {
    res.sendFile(new URL('./dist/index.html', import.meta.url).pathname);
  });
}

// ---------- ERROR HANDLING ----------
// Catch-all error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  
  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: Object.values(err.errors).map(e => e.message)
    });
  }

  // Handle MongoDB duplicate key errors
  if (err.code === 11000) {
    return res.status(409).json({
      error: 'Duplicate Error',
      details: 'A record with this information already exists'
    });
  }

  // Handle other known error types
  if (err.status && err.message) {
    return res.status(err.status).json({
      error: err.name || 'Error',
      details: err.message
    });
  }

  // Default error response
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ---------- SERVER STARTUP & SHUTDOWN ----------
const shutdown = async (code) => {
  console.log('Server shutting down...');
  try {
    await mongoose.connection.close();
    console.log('Database connection closed.');
    process.exit(code);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

const startServer = async () => {
  try {
    await connectDB();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Server startup error:', error);
    shutdown(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));

startServer();