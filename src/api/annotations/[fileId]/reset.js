// src/api/annotations/[fileId]/reset.js
import { connectDB } from '../../../../lib/db.js';
import { File } from '../../../../models/File.js';
import { Annotation } from '../../../../models/Annotation.js';
import { validateAuth } from '../../../middleware/auth.js';
import mongoose from 'mongoose';

export const config = {
  api: {
    bodyParser: true
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
  console.error('Reset error:', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code
  });

  return res.status(status).json({
    success: false,
    error: error.message || 'Failed to reset annotations',
    code: error.code || 'RESET_ERROR',
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
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
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

    // Validate fileId
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      throw new Error('Invalid file ID format');
    }

    // Start transaction
    session = await mongoose.startSession();
    session.startTransaction();
    
    // Verify file exists and belongs to user
    const file = await File.findOne({
      _id: fileId,
      userId: auth.user._id
    }).session(session);

    if (!file) {
      throw new Error('File not found or access denied');
    }

    // Delete all annotations in a transaction
    const deleteResult = await Annotation.deleteMany({
      fileId,
      userId: auth.user._id
    }).session(session);

    // Reset file progress
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

    // Commit the transaction
    await session.commitTransaction();

    return res.json({
      success: true,
      message: 'All annotations reset successfully',
      progress: 0,
      timestamp: new Date(),
      details: {
        fileId,
        deletedCount: deleteResult.deletedCount,
        acknowledged: deleteResult.acknowledged
      }
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