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
    
    // Use lean() to get plain objects and explicitly include all fields
    const files = await File.find(
      { userId: mongoUserId }
    ).lean();

    console.log('Raw files from DB:', JSON.stringify(files[0], null, 2));
    
    const filesWithProgress = await Promise.all(files.map(async (file) => {
      // Log full abstract structure
      console.log('Processing file abstracts:', 
        file.abstracts.map(a => ({
          paper_code: a.paper_code,
          hasEvents: Array.isArray(a.events),
          eventCount: a.events?.length || 0
        }))
      );

      const eventCount = file.abstracts.reduce((sum, abstract) => 
        sum + (abstract.events?.length || 0), 0);

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
      abstractCount: f.abstracts.length,
      eventCounts: f.abstracts.map(a => ({
        paper_code: a.paper_code,
        eventCount: a.events?.length || 0,
        firstEvent: a.events?.[0] ? 'present' : 'missing'
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
    let totalRequired = file.abstracts.reduce((total, abstract) => {
      return total + (abstract.events?.length || 0) * 14; // 14 fields per event
    }, 0);

    // Calculate progress
    const progress = totalRequired > 0 
      ? Math.min((annotations.length * 100) / totalRequired, 100)
      : 0;

    // Create annotations map
    const annotationsMap = {};
    annotations.forEach(ann => {
      const key = `${ann.abstractIndex}-${ann.eventIndex}-${ann.fieldPath}`;
      annotationsMap[key] = {
        answer: ann.answer,
        timestamp: ann.timestamp
      };
    });

    // Update file progress in database
    await File.findByIdAndUpdate(fileId, {
      $set: { progress: Math.round(progress * 10) / 10 }
    });

    // Convert to plain object and ensure events are included
    const fileObj = file.toObject();
    console.log('File response verification:', {
      id: fileObj._id,
      abstractCount: fileObj.abstracts.length,
      eventCounts: fileObj.abstracts.map(a => ({
        paper_code: a.paper_code,
        events: a.events?.length || 0
      }))
    });

    res.json({
      success: true,
      file: {
        _id: fileObj._id,
        name: fileObj.name,
        abstracts: fileObj.abstracts,
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

// file upload endpoint

app.post('/api/files/upload', authenticateAndSync, async (req, res) => {
  try {
    const { name, content } = req.body;
    const mongoUserId = req.user._id;

    // Enable debug mode
    mongoose.set('debug', true);

    console.log('Upload request content:', {
      name,
      abstractCount: content?.length,
      sampleEvents: content?.[0]?.events?.length,
      firstEvent: content?.[0]?.events?.[0] 
    });

    // Prepare file document
    const fileDoc = {
      userId: mongoUserId,
      name,
      abstracts: content.map(abstract => ({
        paper_code: abstract.paper_code,
        abstract: abstract.abstract,
        events: abstract.events.map(event => ({
          'Background/Introduction': event['Background/Introduction'] || '',
          'Methods/Approach': event['Methods/Approach'] || '',
          'Results/Findings': event['Results/Findings'] || '',
          'Conclusions/Implications': event['Conclusions/Implications'] || '',
          'Text': event.Text,
          'Main Action': event['Main Action'] || '',
          Arguments: {
            Agent: event.Arguments?.Agent || '',
            Object: {
              'Base Object': event.Arguments?.Object?.['Base Object'] || '',
              'Base Modifier': event.Arguments?.Object?.['Base Modifier'] || '',
              'Attached Object': event.Arguments?.Object?.['Attached Object'] || '',
              'Attached Modifier': event.Arguments?.Object?.['Attached Modifier'] || ''
            },
            Context: event.Arguments?.Context || '',
            Purpose: event.Arguments?.Purpose || '',
            Method: event.Arguments?.Method || '',
            Results: event.Arguments?.Results || '',
            Analysis: event.Arguments?.Analysis || '',
            Challenge: event.Arguments?.Challenge || '',
            Ethical: event.Arguments?.Ethical || '',
            Implications: event.Arguments?.Implications || '',
            Contradictions: event.Arguments?.Contradictions || ''
          }
        }))
      }))
    };

    // Log document structure before save
    console.log('Document before save:', {
      name: fileDoc.name,
      abstractCount: fileDoc.abstracts.length,
      eventCounts: fileDoc.abstracts.map(a => ({
        paper_code: a.paper_code,
        eventCount: a.events.length,
        firstEvent: a.events[0] ? 'present' : 'missing'
      }))
    });

    // Create and save file
    const newFile = new File(fileDoc);
    const savedFile = await newFile.save();

    // Verify saved document
    const verifiedFile = await File.findById(savedFile._id).lean();
    console.log('Saved document verification:', {
      id: verifiedFile._id,
      abstractCount: verifiedFile.abstracts.length,
      eventCounts: verifiedFile.abstracts.map(a => ({
        paper_code: a.paper_code,
        eventCount: a.events?.length || 0
      }))
    });

    mongoose.set('debug', false);

    res.status(201).json({
      success: true,
      file: verifiedFile,
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
    const { fileId, abstractIndex, eventIndex, fieldPath, answer } = req.body;
    const mongoUserId = req.user._id;

    // Save the annotation
    const annotation = await Annotation.findOneAndUpdate(
      {
        fileId,
        userId: mongoUserId,
        abstractIndex,
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

    // Calculate total steps and current progress
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
          abstractIndex: ann.abstractIndex,
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

    // Update progress
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
// In server.js, update the port configuration
const startServer = async () => {
  try {
    console.log('Attempting MongoDB connection...');
    console.log('MongoDB URI:', process.env.VITE_MONGODB_URI ? 'URI is set' : 'URI is missing');

    // Add connection event listeners before connecting
    mongoose.connection.on('connected', () => {
      console.log('MongoDB connected successfully');
      console.log('Database name:', mongoose.connection.db.databaseName);
      
      // List collections to verify database state
      mongoose.connection.db.listCollections().toArray()
        .then(collections => {
          console.log('Available collections:', collections.map(c => c.name));
        })
        .catch(err => console.error('Error listing collections:', err));
    });

    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });

    // Enable debugging in development
    if (process.env.NODE_ENV === 'development') {
      mongoose.set('debug', true);
    }

    await mongoose.connect(process.env.VITE_MONGODB_URI, {
      serverApi: {
        version: '1',
        strict: true,
        deprecationErrors: true
      },
      retryWrites: true,
      w: 'majority',
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      maxPoolSize: 50
    });

    // Log successful connection details
    console.log('Connected to MongoDB:', {
      database: mongoose.connection.db.databaseName,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      readyState: mongoose.connection.readyState
    });

    // Find available port
    const findAvailablePort = async (startPort) => {
      let port = startPort;
      while (port < startPort + 10) {
        try {
          await new Promise((resolve, reject) => {
            const server = app.listen(port, '0.0.0.0', () => {
              server.removeListener('error', reject);
              resolve(server);
            }).on('error', (err) => {
              if (err.code === 'EADDRINUSE') {
                server.close();
                port++;
                reject(err);
              } else {
                reject(err);
              }
            });
          });
          console.log(`Server running on port ${port}`);
          console.log(`Environment: ${process.env.NODE_ENV}`);
          console.log('MongoDB connection state:', mongoose.connection.readyState);
          
          // Add verification of collections after server starts
          const collections = await mongoose.connection.db.listCollections().toArray();
          console.log('Available collections after server start:', 
            collections.map(c => ({ name: c.name, type: c.type }))
          );
          
          return;
        } catch (err) {
          if (err.code !== 'EADDRINUSE') throw err;
        }
      }
      throw new Error('No available ports found');
    };

    const startPort = process.env.PORT || 3000;
    await findAvailablePort(startPort);

  } catch (error) {
    console.error('Server startup error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    console.error('Connection details:', {
      uri: process.env.VITE_MONGODB_URI ? 'URI is set' : 'URI is missing',
      env: process.env.NODE_ENV,
      mongooseState: mongoose.connection.readyState
    });
    
    if (process.env.NODE_ENV === 'production') {
      console.log('Attempting to recover from error...');
      setTimeout(startServer, 5000);
    } else {
      process.exit(1);
    }
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