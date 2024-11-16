// src/api/vercel/annotations/[fileId].js
import { connectDB } from '../../../lib/db.js';
import { Annotation } from '../../../models/Annotation.js';
import { validateAuth } from '../../middleware/auth.js';
import { File } from '../../../models/File.js';
import mongoose from 'mongoose';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    },
    responseLimit: false
  }
};

// Enhanced CORS with multiple origin support
const setCorsHeaders = (res) => {
  const allowedOrigins = [
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    'http://localhost:5173',
    process.env.NEXT_PUBLIC_CLERK_FRONTEND_API
  ].filter(Boolean);

  const origin = allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins.join(', ');

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours cache for preflight
};

// Consistent error response with tracing
const handleError = (res, error, status = 500) => {
  const traceId = `ann-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  console.error('Annotation API error:', {
    traceId,
    message: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code
  });

  return res.status(status).json({
    success: false,
    error: error.message || 'Internal server error',
    code: error.code || 'ANNOTATION_ERROR',
    traceId,
    timestamp: new Date().toISOString(),
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
};

const validateFileAccess = async (fileId, userId, session) => {
  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new Error('Invalid file ID format');
  }

  const file = await File.findOne({ 
    _id: fileId, 
    userId 
  }).session(session).lean();

  if (!file) {
    throw new Error('File not found or access denied');
  }

  return file;
};

export default async function handler(req, res) {
  const startTime = Date.now();
  console.log('Annotations API request:', {
    method: req.method,
    url: req.url,
    query: req.query,
    body: req.method === 'GET' ? undefined : '[REDACTED]'
  });

  // Always set CORS headers
  setCorsHeaders(res);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let session = null;

  try {
    await connectDB();
    const auth = await validateAuth(req);
    
    if (!auth?.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: 'AUTH_REQUIRED'
      });
    }

    // Start session for transactions
    session = await mongoose.startSession();
    session.startTransaction();

    let result;
    switch (req.method) {
      case 'GET':
        result = await getAnnotations(req, res, auth.user._id, session);
        break;
      case 'POST':
        result = await saveAnnotation(req, res, auth.user._id, session);
        break;
      case 'DELETE':
        result = await deleteAnnotations(req, res, auth.user._id, session);
        break;
      default:
        throw new Error('Method not allowed');
    }

    // Commit transaction
    await session.commitTransaction();
    
    // Add performance metrics
    result.metrics = {
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };

    return res.json(result);

  } catch (error) {
    // Rollback transaction if one was started
    if (session) {
      await session.abortTransaction();
    }
    return handleError(res, error);
  } finally {
    if (session) {
      session.endSession();
    }
  }
}

async function getAnnotations(req, res, userId, session) {
  const { fileId } = req.query;

  // Validate access
  const file = await validateFileAccess(fileId, userId, session);

  // Get annotations efficiently
  const annotations = await Annotation.find({ 
    fileId,
    userId 
  })
  .sort({ timestamp: -1 })
  .lean()
  .session(session);

  // Format annotations for response
  const formattedAnnotations = annotations.reduce((acc, ann) => {
    const key = `${ann.abstractIndex}-${ann.sentenceIndex}-${ann.entityIndex}`;
    acc[key] = {
      answer: ann.answer,
      timestamp: ann.timestamp
    };
    return acc;
  }, {});

  // Calculate progress
  const progress = Math.min((annotations.length * 100) / file.totalSteps, 100);

  return {
    success: true,
    annotations: formattedAnnotations,
    progress: Math.round(progress * 10) / 10,
    timestamp: new Date().toISOString(),
    fileId,
    totalSteps: file.totalSteps,
    count: annotations.length
  };
}

async function saveAnnotation(req, res, userId, session) {
  const { fileId } = req.query;
  const { abstractIndex, sentenceIndex, entityIndex, answer } = req.body;

  // Validate input
  if (typeof abstractIndex !== 'number' || 
      typeof sentenceIndex !== 'number' || 
      typeof entityIndex !== 'number' || 
      !answer) {
    throw new Error('Invalid annotation data');
  }

  // Validate file access
  const file = await validateFileAccess(fileId, userId, session);

  // Save annotation with optimistic locking
  const annotation = await Annotation.findOneAndUpdate(
    {
      userId,
      fileId,
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
      upsert: true,
      session,
      runValidators: true
    }
  );

  // Update progress
  const totalAnnotations = await Annotation.countDocuments({
    fileId,
    userId
  }).session(session);

  const progress = Math.min((totalAnnotations * 100) / file.totalSteps, 100);
  
  await File.findByIdAndUpdate(
    fileId,
    { 
      $set: { 
        progress: Math.round(progress * 10) / 10,
        lastModified: new Date()
      } 
    },
    { session }
  );

  return {
    success: true,
    annotation,
    progress: Math.round(progress * 10) / 10,
    timestamp: new Date().toISOString(),
    count: totalAnnotations
  };
}

async function deleteAnnotations(req, res, userId, session) {
  const { fileId } = req.query;

  // Validate file access
  await validateFileAccess(fileId, userId, session);

  // Delete annotations
  const result = await Annotation.deleteMany({ 
    fileId, 
    userId 
  }).session(session);

  // Reset progress
  await File.findByIdAndUpdate(
    fileId,
    { 
      $set: { 
        progress: 0,
        lastModified: new Date()
      } 
    },
    { session }
  );

  return {
    success: true,
    message: 'Annotations deleted successfully',
    fileId,
    timestamp: new Date().toISOString(),
    deletedCount: result.deletedCount
  };
}