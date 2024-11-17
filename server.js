// server.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { User } from './src/models/User.js';
import { File } from './src/models/File.js';
import { Annotation } from './src/models/Annotation.js';

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const port = process.env.PORT || 3000;

// Basic Middleware Setup
app.use(cors({
  origin: ['http://localhost:5173', process.env.CLIENT_URL].filter(Boolean),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`, {
    headers: req.headers,
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined
  });
  next();
});

// Auth Middleware Definition
const requireAuth = async (req, res, next) => {
  console.log('Starting auth check...');
  try {
    const authHeader = req.headers.authorization;
    console.log('Auth header present:', !!authHeader);
    
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('Invalid or missing Bearer token');
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.split(' ')[1];
    console.log('Token extracted, attempting verification...');
    
    try {
      const decoded = await clerkClient.verifyToken(token);
      console.log('Token verified successfully for user:', decoded.sub);
      
      req.auth = {
        userId: decoded.sub,
        sessionId: decoded.sid,
        session: decoded
      };

      next();
    } catch (error) {
      console.error('Token verification failed:', error);
      return res.status(401).json({
        error: 'Invalid token',
        details: error.message
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({
      error: 'Authentication failed',
      details: error.message
    });
  }
};

const withUserSync = async (req, res, next) => {
  console.log('Starting user sync...');
  try {
    if (!req.auth?.userId) {
      console.log('No userId found in auth context');
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'Authentication required'
      });
    }

    console.log('Fetching Clerk user details for:', req.auth.userId);
    const clerkUser = await clerkClient.users.getUser(req.auth.userId);
    console.log('Clerk user fetched:', {
      id: clerkUser.id,
      email: clerkUser.emailAddresses[0]?.emailAddress,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName
    });
    
    console.log('MongoDB connection state:', mongoose.connection.readyState);
    
    let user = await User.findOne({ clerkId: req.auth.userId });
    console.log('Existing user found:', !!user);
    
    if (!user) {
      console.log('Creating new user in MongoDB...');
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
      console.log('New user created with ID:', user._id);
    } else {
      console.log('Updating existing user...');
      user.email = clerkUser.emailAddresses[0]?.emailAddress;
      user.firstName = clerkUser.firstName;
      user.lastName = clerkUser.lastName;
      user.lastLoginAt = new Date();
      await user.save();
      console.log('User updated successfully');
    }

    req.user = user;
    console.log('User sync completed successfully');
    next();
  } catch (error) {
    console.error('User sync error:', {
      message: error.message,
      stack: error.stack,
      code: error.code
    });
    res.status(500).json({
      error: 'User synchronization failed',
      details: error.message,
      code: error.code
    });
  }
};

// Combined middleware - defined before use
const authenticateAndSync = [requireAuth, withUserSync];

// Import routes after middleware definitions
import annotationsRouter from './src/api/routes/annotations.js';

// Route handlers
app.use('/api/annotations', authenticateAndSync, annotationsRouter);

// Basic test route
app.get('/api/test', (req, res) => {
  console.log('Test endpoint hit');
  res.json({ message: 'Server is reachable' });
});

// Files routes
app.get('/api/files', authenticateAndSync, async (req, res) => {
  console.log('GET /api/files endpoint hit');
  try {
    const mongoUserId = req.user._id;
    console.log('Fetching files for MongoDB userId:', mongoUserId);
    
    const files = await File.find({ userId: mongoUserId });
    console.log('Found files:', files.length);
    
    const filesWithProgress = await Promise.all(files.map(async (file) => {
      const annotations = await Annotation.countDocuments({
        fileId: file._id,
        userId: mongoUserId
      });
      
      const progress = file.totalSteps > 0 
        ? Math.min((annotations * 100) / file.totalSteps, 100)
        : 0;

      return {
        ...file.toObject(),
        progress: Math.round(progress * 10) / 10
      };
    }));

    res.json({
      success: true,
      files: filesWithProgress
    });
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({
      error: 'Failed to fetch files',
      details: error.message
    });
  }
});


// Add this route after your existing /api/files route

// Get single file with annotations
app.get('/api/files/:fileId', authenticateAndSync, async (req, res) => {
  try {
    const { fileId } = req.params;
    const mongoUserId = req.user._id;

    const [file, annotations] = await Promise.all([
      File.findOne({ _id: fileId, userId: mongoUserId }),
      Annotation.find({ fileId, userId: mongoUserId }).lean()
    ]);

    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Calculate total required annotations
    let totalRequired = file.abstracts.reduce((total, abstract) => {
      return total + abstract.sentences.reduce((sentTotal, sentence) => {
        return sentTotal + sentence.scientific_entities.length + 1; // +1 for sentence itself
      }, 0);
    }, 0);

    // Calculate progress
    const progress = totalRequired > 0 
      ? Math.min((annotations.length * 100) / totalRequired, 100)
      : 0;

    // Create annotations map
    const annotationsMap = {};
    annotations.forEach(ann => {
      const key = `${ann.abstractIndex}-${ann.sentenceIndex}-${ann.entityIndex}`;
      annotationsMap[key] = {
        answer: ann.answer,
        timestamp: ann.timestamp
      };
    });

    // Update file progress in database
    await File.findByIdAndUpdate(fileId, {
      $set: { progress: Math.round(progress * 10) / 10 }
    });

    res.json({
      success: true,
      file: {
        _id: file._id,
        name: file.name,
        abstracts: file.abstracts,
        totalSteps: totalRequired,
        progress: Math.round(progress * 10) / 10,
        uploadDate: file.uploadDate,
        metadata: file.metadata || {},
        annotations: annotationsMap
      }
    });
  } catch (error) {
    console.error('Error fetching file:', error);
    res.status(500).json({
      error: 'Failed to fetch file',
      details: error.message
    });
  }
});

// Add file deletion route
app.delete('/api/files/:fileId', authenticateAndSync, async (req, res) => {
  try {
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

    // Delete both file and its annotations
    await Promise.all([
      File.deleteOne({ _id: fileId }),
      Annotation.deleteMany({ fileId })
    ]);

    res.json({
      success: true,
      message: 'File and related annotations deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete file',
      details: error.message
    });
  }
});

app.post('/api/files/upload', authenticateAndSync, async (req, res) => {
  try {
    const { name, content } = req.body;
    const mongoUserId = req.user._id;

    if (!name || !content) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: 'Name and content are required'
      });
    }

    if (!Array.isArray(content)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file format',
        details: 'Content must be an array of abstracts'
      });
    }

    const totalSteps = content.reduce((total, abstract) => {
      if (!abstract.sentences || !Array.isArray(abstract.sentences)) {
        return total;
      }
      return total + abstract.sentences.reduce((sentTotal, sentence) => {
        const entityCount = sentence.scientific_entities?.length || 0;
        return sentTotal + entityCount + 1;
      }, 0);
    }, 0);

    const newFile = new File({
      userId: mongoUserId,
      name,
      abstracts: content,
      totalSteps,
      progress: 0,
      uploadDate: new Date()
    });

    const savedFile = await newFile.save();

    res.status(201).json({
      success: true,
      file: savedFile,
      message: 'File uploaded successfully'
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload file',
      details: error.message,
      validationErrors: error.errors ? 
        Object.keys(error.errors).reduce((acc, key) => {
          acc[key] = error.errors[key].message;
          return acc;
        }, {}) : 
        undefined
    });
  }
});

app.get('/api/annotations/:fileId', authenticateAndSync, async (req, res) => {
  try {
    const { fileId } = req.params;
    const mongoUserId = req.user._id;

    // Fetch annotations
    const annotations = await Annotation.find({
      fileId,
      userId: mongoUserId
    }).lean();

    res.json({
      success: true,
      annotations: annotations.map(ann => ({
        abstractIndex: ann.abstractIndex,
        sentenceIndex: ann.sentenceIndex,
        entityIndex: ann.entityIndex,
        answer: ann.answer,
        timestamp: ann.timestamp
      }))
    });
  } catch (error) {
    console.error('Error fetching annotations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch annotations',
      details: error.message
    });
  }
});

// Add route to save annotations
app.post('/api/annotations', authenticateAndSync, async (req, res) => {
  try {
    const { fileId, abstractIndex, sentenceIndex, entityIndex, answer } = req.body;
    const mongoUserId = req.user._id;

    // Upsert the annotation
    const annotation = await Annotation.findOneAndUpdate(
      {
        fileId,
        userId: mongoUserId,
        abstractIndex,
        sentenceIndex,
        entityIndex
      },
      {
        $set: {
          answer,
          timestamp: new Date()
        }
      },
      {
        new: true,
        upsert: true
      }
    );

    // Calculate new progress
    const totalAnnotations = await Annotation.countDocuments({
      fileId,
      userId: mongoUserId
    });

    const file = await File.findById(fileId);
    const progress = Math.min((totalAnnotations * 100) / file.totalSteps, 100);

    // Update file progress
    await File.findByIdAndUpdate(fileId, {
      $set: { progress: Math.round(progress * 10) / 10 }
    });

    res.json({
      success: true,
      annotation,
      progress
    });
  } catch (error) {
    console.error('Error saving annotation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save annotation',
      details: error.message
    });
  }
});

app.delete('/api/annotations/:fileId', authenticateAndSync, async (req, res) => {
  try {
    const { fileId } = req.params;
    const mongoUserId = req.user._id;

    // Verify the file exists and belongs to the user
    const file = await File.findOne({
      _id: fileId,
      userId: mongoUserId
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
        details: 'File does not exist or you do not have permission to access it'
      });
    }

    // Delete all annotations for this file
    await Annotation.deleteMany({
      fileId,
      userId: mongoUserId
    });

    // Reset file progress
    await File.findByIdAndUpdate(fileId, {
      $set: { progress: 0 }
    });

    res.json({
      success: true,
      message: 'All annotations reset successfully'
    });
  } catch (error) {
    console.error('Error resetting annotations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset annotations',
      details: error.message
    });
  }
});
app.post('/api/annotations/:fileId/reset', authenticateAndSync, async (req, res) => {
  try {
    const { fileId } = req.params;
    const mongoUserId = req.user._id;

    // Verify the file exists and belongs to the user
    const file = await File.findOne({
      _id: fileId,
      userId: mongoUserId
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found',
        details: 'File does not exist or you do not have permission to access it'
      });
    }

    // Delete all annotations for this file
    await Annotation.deleteMany({
      fileId,
      userId: mongoUserId
    });

    // Reset file progress
    await File.findByIdAndUpdate(fileId, {
      $set: { progress: 0 }
    });

    res.json({
      success: true,
      message: 'All annotations reset successfully',
      progress: 0
    });
  } catch (error) {
    console.error('Error resetting annotations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset annotations',
      details: error.message
    });
  }
});

// Add route to sync annotations
app.post('/api/annotations/:fileId/sync', authenticateAndSync, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { annotations = [], reset = false } = req.body;
    const mongoUserId = req.user._id;

    // Handle reset request
    if (reset || annotations.length === 0) {
      await Annotation.deleteMany({
        fileId,
        userId: mongoUserId
      });

      await File.findByIdAndUpdate(fileId, {
        $set: { progress: 0 }
      });

      return res.json({
        success: true,
        progress: 0,
        message: 'Annotations reset successfully'
      });
    }

    // Handle normal sync
    const operations = annotations.map(ann => ({
      updateOne: {
        filter: {
          fileId,
          userId: mongoUserId,
          abstractIndex: ann.abstractIndex,
          sentenceIndex: ann.sentenceIndex,
          entityIndex: ann.entityIndex
        },
        update: {
          $set: {
            answer: ann.answer,
            timestamp: new Date(ann.timestamp)
          }
        },
        upsert: true
      }
    }));

    await Annotation.bulkWrite(operations);

    // Update progress
    const totalAnnotations = await Annotation.countDocuments({
      fileId,
      userId: mongoUserId
    });

    const file = await File.findById(fileId);
    const progress = Math.min((totalAnnotations * 100) / file.totalSteps, 100);

    await File.findByIdAndUpdate(fileId, {
      $set: { progress: Math.round(progress * 10) / 10 }
    });

    res.json({
      success: true,
      progress,
      message: 'Annotations synced successfully'
    });
  } catch (error) {
    console.error('Error syncing annotations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync annotations',
      details: error.message
    });
  }
});

// Add this before the general error handler
app.use('/api/annotations', (err, req, res, next) => {
  console.error('Annotation API Error:', err);
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: Object.values(err.errors).map(e => e.message)
    });
  }
  next(err);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
const startServer = async () => {
  try {
    console.log('Attempting MongoDB connection...');
    console.log('MongoDB URI:', process.env.MONGODB_URI ? 'URI is set' : 'URI is missing');
    
    await mongoose.connect(process.env.MONGODB_URI, {
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true
      },
      retryWrites: true,
      w: 'majority'
    });
    
    console.log('MongoDB Connected successfully');
    console.log('Database name:', mongoose.connection.db.databaseName);
    
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log('MongoDB connection state:', mongoose.connection.readyState);
    });
  } catch (error) {
    console.error('Server startup error:', error);
    console.error('Connection details:', {
      uri: process.env.MONGODB_URI ? 'URI is set' : 'URI is missing',
      env: process.env.NODE_ENV
    });
    process.exit(1);
  }
};

startServer();