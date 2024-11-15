// src/api/annotations/[fileId].js
import { connectDB } from '../../../lib/db.js';
import { Annotation } from '../../../models/Annotation.js';
import { validateAuth } from '../../middleware/auth.js';
import { File } from '../../../models/File.js';
import mongoose from 'mongoose';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};

// Helper to set consistent CORS headers
const setCorsHeaders = (res) => {
  const allowedOrigins = [
    process.env.VERCEL_URL,
    'http://localhost:5173',
    process.env.NEXT_PUBLIC_CLERK_FRONTEND_API
  ].filter(Boolean);

  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', allowedOrigins.join(', '));
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
};

// Consistent error response helper
const handleError = (res, error, status = 500) => {
  console.error('Annotation API error:', {
    message: error.message,
    stack: error.stack,
    name: error.name
  });

  return res.status(status).json({
    success: false,
    error: error.message || 'Internal server error',
    code: error.code || 'ANNOTATION_ERROR',
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
};

export default async function handler(req, res) {
  // Always set CORS headers first
  setCorsHeaders(res);

  // Handle preflight requests
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

    // Start session for transactions if needed
    session = await mongoose.startSession();
    session.startTransaction();

    let result;
    switch (req.method) {
      case 'GET':
        result = await getAnnotations(req, res, auth.user._id);
        break;
      case 'POST':
        result = await saveAnnotation(req, res, auth.user._id, session);
        break;
      case 'DELETE':
        result = await deleteAnnotations(req, res, auth.user._id, session);
        break;
      default:
        await session?.abortTransaction();
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Commit transaction if one was started
    if (session) {
      await session.commitTransaction();
      result.synced = true;
    }

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

async function getAnnotations(req, res, userId) {
  const { fileId } = req.query;

  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new Error('Invalid file ID format');
  }

  // Get annotations and verify file access
  const [annotations, file] = await Promise.all([
    Annotation.find({ 
      fileId,
      userId 
    }).sort({ timestamp: -1 }).lean(),
    File.findOne({ _id: fileId, userId }).lean()
  ]);

  if (!file) {
    throw new Error('File not found or access denied');
  }

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
    timestamp: new Date(),
    fileId,
    totalSteps: file.totalSteps
  };
}

async function saveAnnotation(req, res, userId, session) {
  const { fileId } = req.query;
  const { abstractIndex, sentenceIndex, entityIndex, answer } = req.body;

  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new Error('Invalid file ID format');
  }

  // Validate file access and existence
  const file = await File.findOne({ 
    _id: fileId, 
    userId 
  }).session(session);

  if (!file) {
    throw new Error('File not found or access denied');
  }

  // Save annotation
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
    { $set: { progress: Math.round(progress * 10) / 10 } },
    { session }
  );

  return {
    success: true,
    annotation,
    progress: Math.round(progress * 10) / 10,
    timestamp: new Date()
  };
}

async function deleteAnnotations(req, res, userId, session) {
  const { fileId } = req.query;

  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new Error('Invalid file ID format');
  }

  // Verify file access and existence
  const file = await File.findOne({
    _id: fileId,
    userId
  }).session(session);

  if (!file) {
    throw new Error('File not found or access denied');
  }

  // Delete annotations
  await Annotation.deleteMany({ 
    fileId, 
    userId 
  }).session(session);

  // Reset progress
  await File.findByIdAndUpdate(
    fileId,
    { $set: { progress: 0 } },
    { session }
  );

  return {
    success: true,
    message: 'Annotations deleted successfully',
    fileId,
    timestamp: new Date()
  };
}