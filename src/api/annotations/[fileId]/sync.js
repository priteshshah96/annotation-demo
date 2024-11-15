// src/api/annotations/[fileId]/sync.js
import { connectDB } from '../../../../lib/db.js';
import { File } from '../../../../models/File.js';
import { Annotation } from '../../../../models/Annotation.js';
import { validateAuth } from '../../../middleware/auth.js';
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
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
};

// Consistent error handling
const handleError = (res, error, status = 500) => {
  console.error('Annotation sync error:', {
    message: error.message,
    stack: error.stack,
    name: error.name
  });

  return res.status(status).json({
    success: false,
    error: error.message || 'Sync failed',
    code: error.code || 'SYNC_ERROR',
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
};

export default async function handler(req, res) {
  // Always set CORS headers first
  setCorsHeaders(res);

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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

    const { fileId } = req.query;
    const { annotations = [], reset = false } = req.body;

    // Validate fileId
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      throw new Error('Invalid file ID format');
    }

    // Start transaction
    session = await mongoose.startSession();
    session.startTransaction();

    // Verify file access
    const file = await File.findOne({ 
      _id: fileId, 
      userId: auth.user._id 
    }).session(session);

    if (!file) {
      throw new Error('File not found or access denied');
    }

    // Handle reset request
    if (reset || annotations.length === 0) {
      await Annotation.deleteMany({
        fileId,
        userId: auth.user._id
      }).session(session);

      await File.findByIdAndUpdate(fileId, {
        $set: { progress: 0 }
      }).session(session);

      await session.commitTransaction();

      return res.json({
        success: true,
        progress: 0,
        message: 'Annotations reset successfully',
        timestamp: new Date()
      });
    }

    // Validate annotations
    for (const ann of annotations) {
      if (typeof ann.abstractIndex !== 'number' || 
          typeof ann.sentenceIndex !== 'number' || 
          typeof ann.entityIndex !== 'number' || 
          !ann.answer) {
        throw new Error('Invalid annotation format');
      }
    }

    // Prepare bulk operations
    const operations = annotations.map(ann => ({
      updateOne: {
        filter: {
          fileId,
          userId: auth.user._id,
          abstractIndex: ann.abstractIndex,
          sentenceIndex: ann.sentenceIndex,
          entityIndex: ann.entityIndex
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

    // Execute bulk write
    await Annotation.bulkWrite(operations, { session });

    // Update progress
    const totalAnnotations = await Annotation.countDocuments({
      fileId,
      userId: auth.user._id
    }).session(session);

    const progress = Math.min((totalAnnotations * 100) / file.totalSteps, 100);
    const roundedProgress = Math.round(progress * 10) / 10;

    await File.findByIdAndUpdate(fileId, {
      $set: { progress: roundedProgress }
    }).session(session);

    await session.commitTransaction();

    return res.json({
      success: true,
      progress: roundedProgress,
      message: 'Annotations synced successfully',
      timestamp: new Date(),
      syncedCount: operations.length
    });

  } catch (error) {
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