import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { User } from './src/models/User.js';
import { File } from './src/models/File.js';
import { Annotation } from './src/models/Annotation.js';
import { connectDB } from './src/lib/db.js'; // Import the connectDB function

// Load environment variables
dotenv.config();

// Initialize express app
const app = express();
const port = process.env.PORT || 3000;

// Basic Middleware Setup
app.use(cors({
  origin: ['http://localhost:5173', process.env.CLIENT_URL, 'https://annotation-demo.onrender.com'].filter(Boolean),
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
  try {
    const mongoUserId = req.user._id;
    console.log('GET /api/files endpoint hit for user:', mongoUserId);
    
    const files = await File.find(
      { userId: mongoUserId }
    ).lean();

    console.log('Raw files from DB:', JSON.stringify(files[0], null, 2));
    
    const filesWithProgress = await Promise.all(files.map(async (file) => {
      console.log('Processing file papers:', 
        file.papers.map(p => ({
          paper_code: p.paper_code,
          hasEvents: Array.isArray(p.events),
          eventCount: p.events?.length || 0
        }))
      );

      const eventCount = file.papers.reduce((sum, paper) => 
        sum + (paper.events?.length || 0), 0);

      const annotations = await Annotation.countDocuments({
        fileId: file._id,
        userId: mongoUserId
      });
      
      const totalSteps = eventCount * 14;
      const progress = totalSteps > 0 
        ? Math.min((annotations * 100) / totalSteps, 100)
        : 0;

      return {
        ...file,
        eventCount,
        totalSteps,
        progress: Math.round(progress * 10) / 10
      };
    }));

    console.log('Response verification:', filesWithProgress.map(f => ({
      name: f.name,
      paperCount: f.papers.length,
      eventCounts: f.papers.map(p => ({
        paper_code: p.paper_code,
        eventCount: p.events?.length || 0,
        firstEvent: p.events?.[0] ? 'present' : 'missing'
      }))
    })));

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

    // Calculate total required annotations based on events
    let totalRequired = file.papers.reduce((total, paper) => {
      return total + (paper.events?.length || 0) * 14; // 14 fields per event
    }, 0);

    const progress = totalRequired > 0 
      ? Math.min((annotations.length * 100) / totalRequired, 100)
      : 0;

    // Create annotations map
    const annotationsMap = {};
    annotations.forEach(ann => {
      const key = `${ann.paperIndex}-${ann.eventIndex}-${ann.fieldPath}`;
      annotationsMap[key] = {
        answer: ann.answer,
        timestamp: ann.timestamp
      };
    });

    await File.findByIdAndUpdate(fileId, {
      $set: { progress: Math.round(progress * 10) / 10 }
    });

    const fileObj = file.toObject();
    console.log('File response verification:', {
      id: fileObj._id,
      paperCount: fileObj.papers.length,
      eventCounts: fileObj.papers.map(p => ({
        paper_code: p.paper_code,
        events: p.events?.length || 0
      }))
    });

    res.json({
      success: true,
      file: {
        _id: fileObj._id,
        name: fileObj.name,
        papers: fileObj.papers,
        totalSteps: totalRequired,
        progress: Math.round(progress * 10) / 10,
        uploadDate: fileObj.uploadDate,
        metadata: fileObj.metadata || {}
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

// File upload endpoint
app.post('/api/files/upload', authenticateAndSync, async (req, res) => {
  try {
    const { name, papers, userId: clientUserId } = req.body;
    const mongoUserId = req.user._id;

    // Debug logging
    console.log('Upload request body:', {
      name,
      papersPresent: Array.isArray(papers),
      paperCount: papers?.length,
      samplePaper: papers?.[0] ? {
        hasCode: !!papers[0].paper_code,
        hasAbstract: !!papers[0].abstract,
        eventCount: papers[0].events?.length
      } : null
    });

    if (!Array.isArray(papers)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
        details: 'Papers must be an array'
      });
    }

    // Calculate metadata
    const totalEvents = papers.reduce((sum, paper) => 
      sum + (paper.events?.length || 0), 0);

    // Prepare file document
    const fileDoc = {
      userId: mongoUserId,
      name,
      papers, // Store papers as-is
      metadata: {
        totalPapers: papers.length,
        totalEvents,
        totalFields: totalEvents * 14 // Assuming 14 fields per event
      },
      progress: 0
    };

    // Debug log document structure
    console.log('Document structure check:', {
      name: fileDoc.name,
      paperCount: fileDoc.papers.length,
      papers: fileDoc.papers.map(p => ({
        code: p.paper_code,
        eventCount: p.events?.length
      }))
    });

    const newFile = new File(fileDoc);
    const savedFile = await newFile.save();

    res.status(201).json({
      success: true,
      file: savedFile,
      message: 'File uploaded successfully'
    });

  } catch (error) {
    console.error('Upload error:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to upload file',
      details: error.message
    });
  }
});

// Save annotation
app.post('/api/annotations', authenticateAndSync, async (req, res) => {
  try {
    const { fileId, paperIndex, eventIndex, fieldPath, answer } = req.body;
    const mongoUserId = req.user._id;

    // Save the annotation
    const annotation = await Annotation.findOneAndUpdate(
      {
        fileId,
        userId: mongoUserId,
        paperIndex,
        eventIndex,
        fieldPath
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

    const file = await File.findById(fileId);
    if (!file) {
      throw new Error('File not found');
    }

    const totalAnnotations = await Annotation.countDocuments({
      fileId,
      userId: mongoUserId
    });

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

// Sync annotations
app.post('/api/annotations/:fileId/sync', authenticateAndSync, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { annotations = [] } = req.body;
    const mongoUserId = req.user._id;

    // Handle batch update
    const operations = annotations.map(ann => ({
      updateOne: {
        filter: {
          fileId,
          userId: mongoUserId,
          paperIndex: ann.paperIndex,
          eventIndex: ann.eventIndex,
          fieldPath: ann.fieldPath
        },
        update: {
          $set: {
            answer: ann.answer,
            timestamp: new Date(ann.timestamp || Date.now())
          }
        },
        upsert: true
      }
    }));

    await Annotation.bulkWrite(operations);

    const [totalAnnotations, file] = await Promise.all([
      Annotation.countDocuments({ fileId, userId: mongoUserId }),
      File.findById(fileId)
    ]);

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

// Reset annotations
app.post('/api/annotations/:fileId/reset', authenticateAndSync, async (req, res) => {
  try {
    const { fileId } = req.params;
    const mongoUserId = req.user._id;

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

// before general error handler
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

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  
  // Handle client-side routing
  app.get('*', (req, res) => {
    res.sendFile(new URL('./dist/index.html', import.meta.url).pathname);
  });
}

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
    await connectDB(); // Use the imported connectDB function
    
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
};

// Handle process termination
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});

startServer();