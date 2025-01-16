import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { User } from './src/models/User.js';
import { File } from './src/models/File.js';
import { Annotation } from './src/models/Annotation.js';
import { connectDB } from './src/lib/db.js';

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
      return res.status(401).json({
        error: 'Invalid token',
        details: error.message
      });
    }
  } catch (error) {
    res.status(401).json({
      error: 'Authentication failed',
      details: error.message
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
    res.status(500).json({
      error: 'User synchronization failed',
      details: error.message,
      code: error.code
    });
  }
};

// Combined middleware
const authenticateAndSync = [requireAuth, withUserSync];

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is reachable' });
});

// ---------- FILE ROUTES ----------
// Get all files route
app.get('/api/files', authenticateAndSync, async (req, res) => {
  try {
    const mongoUserId = req.user._id;
    const files = await File.find({ userId: mongoUserId }).lean();
    
    // Only include basic file info and metadata
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
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch files',
      details: error.message
    });
  }
});

// Get single file route
app.get('/api/files/:fileId', authenticateAndSync, async (req, res) => {
  try {
    const { fileId } = req.params;
    const mongoUserId = req.user._id;

    // Fetch both file and annotations in parallel
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

    const fileObj = file.toObject();
    
    res.json({
      success: true,
      papers: fileObj.papers,
      annotations: annotations,
      uploadDate: fileObj.uploadDate,
      metadata: {
        totalPapers: fileObj.papers.length,
        totalEvents: fileObj.papers.reduce((sum, paper) => 
          sum + (paper.events?.length || 0), 0)
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch file',
      details: error.message
    });
  }
});

// Upload new file route
app.post('/api/files/upload', authenticateAndSync, async (req, res) => {
  try {
    const { name, papers } = req.body;
    const mongoUserId = req.user._id;

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
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to upload file',
      details: error.message
    });
  }
});

// Delete file
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

    await Promise.all([
      File.deleteOne({ _id: fileId }),
      Annotation.deleteMany({ fileId })
    ]);

    res.json({
      success: true,
      message: 'File and related annotations deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to delete file',
      details: error.message
    });
  }
});


// ---------- ANNOTATION ROUTES ----------
// Get annotations for a file
app.get('/api/annotations/:fileId', authenticateAndSync, async (req, res) => {
  try {
    const { fileId } = req.params;
    const mongoUserId = req.user._id;

    const annotations = await Annotation.find({
      fileId,
      userId: mongoUserId
    }).lean();

    res.json({
      success: true,
      annotations,
      progress: null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch annotations',
      details: error.message
    });
  }
});

// Save single annotation
app.post('/api/annotations', authenticateAndSync, async (req, res) => {
  try {
    let { fileId, paperIndex, eventIndex, fieldPath, answer, isDelete } = req.body;
    console.log('Received annotation save request:', {
      fileId, paperIndex, eventIndex, fieldPath, answer, isDelete
    });

    const mongoUserId = req.user._id;

    // Convert indices to numbers
    paperIndex = Number(paperIndex);
    eventIndex = Number(eventIndex);

    if (isNaN(paperIndex) || isNaN(eventIndex) || paperIndex < 0 || eventIndex < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid indices',
        details: 'Paper or event index out of bounds'
      });
    }

    // Verify file exists and user has access
    const file = await File.findOne({
      _id: fileId,
      userId: mongoUserId
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    // Verify event exists
    if (!file.papers[paperIndex]?.events[eventIndex]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid indices',
        details: 'Paper or event index out of bounds'
      });
    }

    // Handle deletion
    if (isDelete) {
      await Annotation.findOneAndDelete({
        fileId,
        userId: mongoUserId,
        paperIndex,
        eventIndex,
        fieldPath
      });

      return res.json({
        success: true,
        message: 'Annotation deleted successfully'
      });
    }

    // Process and validate annotation based on field type
    const isEventType = AnnotationTypes.EVENT_TYPE.includes(fieldPath);
    const isMainAction = fieldPath === AnnotationTypes.MAIN_ACTION;
    const isArgument = fieldPath.startsWith('Arguments.') || fieldPath.startsWith('Object.');

    let processedAnswer;

    if (isEventType) {
      // Event types must be strings
      if (typeof answer !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: `${fieldPath} must be a string`
        });
      }
      processedAnswer = answer.trim();
    } 
    else if (isMainAction) {
      // Main Action should have text and spans
      if (!answer || typeof answer.text !== 'string' || !Array.isArray(answer.spans)) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: 'Main Action must include text and spans array'
        });
      }

      // Validate each span
      for (const span of answer.spans) {
        if (!span.text || typeof span.start !== 'number' || typeof span.end !== 'number' ||
            span.start < 0 || span.end <= span.start) {
          return res.status(400).json({
            success: false,
            error: 'Validation Error',
            details: 'Invalid span format in Main Action'
          });
        }
      }

      processedAnswer = {
        text: answer.text.trim(),
        spans: answer.spans
          .map(span => ({
            text: span.text,
            start: Number(span.start),
            end: Number(span.end)
          }))
          .sort((a, b) => a.start - b.start)
      };
    } 
    else if (isArgument) {
      // Arguments should have spans array
      if (!Array.isArray(answer) || answer.length === 0 || 
          !answer.every(span => 
            span.text && 
            typeof span.start === 'number' && 
            typeof span.end === 'number' &&
            span.start >= 0 && 
            span.end > span.start
          )) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: 'Arguments require valid span data array'
        });
      }

      // Get existing annotation to handle multiple spans
      const existingAnnotation = await Annotation.findOne({
        fileId,
        userId: mongoUserId,
        paperIndex,
        eventIndex,
        fieldPath
      });

      let spans = [];
      if (existingAnnotation?.answer?.spans) {
        spans = [...existingAnnotation.answer.spans];
      }

      // Add new span
      spans.push({
        text: answer.text,
        start: Number(answer.start),
        end: Number(answer.end)
      });

      // Sort spans by start position
      spans.sort((a, b) => a.start - b.start);

      // Check for overlapping spans
      for (let i = 0; i < spans.length - 1; i++) {
        if (spans[i].end > spans[i + 1].start) {
          return res.status(400).json({
            success: false,
            error: 'Validation Error',
            details: 'Spans cannot overlap'
          });
        }
      }

      processedAnswer = {
        text: spans.map(s => s.text).join(' '),
        spans
      };
    } 
    else {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: 'Invalid field path'
      });
    }

    // Save or update the annotation
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
          answer: processedAnswer,
          timestamp: new Date()
        }
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    );

    console.log('Saved annotation:', annotation);

    res.json({
      success: true,
      annotation
    });

  } catch (error) {
    console.error('Annotation save error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to save annotation',
      details: error.message
    });
  }
});

// Delete annotations for a file
app.delete('/api/annotations/:fileId', authenticateAndSync, async (req, res) => {
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
        details: 'File does not exist or you do not have permission to access it'
      });
    }

    await Annotation.deleteMany({
      fileId,
      userId: mongoUserId
    });

    await File.findByIdAndUpdate(fileId, {
      $set: { progress: 0 }
    });

    res.json({
      success: true,
      message: 'All annotations reset successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to reset annotations',
      details: error.message
    });
  }
});

// Sync annotations in batch
app.post('/api/annotations/:fileId/sync', authenticateAndSync, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { annotations = [] } = req.body;
    const mongoUserId = req.user._id;

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

    await Annotation.deleteMany({
      fileId,
      userId: mongoUserId
    });

    await File.findByIdAndUpdate(fileId, {
      $set: { progress: 0 }
    });

    res.json({
      success: true,
      message: 'All annotations reset successfully',
      progress: 0
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to reset annotations',
      details: error.message
    });
  }
});

// ---------- PRODUCTION SETUP ----------
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('dist'));
  app.get('*', (req, res) => {
    res.sendFile(new URL('./dist/index.html', import.meta.url).pathname);
  });
}

// ---------- ERROR HANDLING ----------
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// ---------- SERVER STARTUP ----------
const startServer = async () => {
  try {
    await connectDB();
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    console.error('Server startup error:', error);
    process.exit(1);
  }
};

process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
});

startServer();