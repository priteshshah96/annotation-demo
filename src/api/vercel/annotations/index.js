// src/api/annotations/index.js
import { connectDB } from '../../../lib/db.js';
import { File } from '../../../models/File.js';
import { Annotation } from '../../../models/Annotation.js';
import { validateAuth } from '../../middleware/auth.js';
import mongoose from 'mongoose';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4mb'
    }
  }
};

// Consistent error handling
const handleError = (res, error, status = 500) => {
  console.error('Annotation error:', {
    message: error.message,
    stack: error.stack,
    name: error.name,
    code: error.code
  });

  return res.status(status).json({
    success: false,
    error: error.message || 'Failed to save annotation',
    code: error.code || 'ANNOTATION_ERROR',
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
};

// Validation helper
const validateAnnotationData = (data) => {
  const { fileId, abstractIndex, sentenceIndex, entityIndex, answer } = data;

  if (!mongoose.Types.ObjectId.isValid(fileId)) {
    throw new Error('Invalid file ID format');
  }

  if (typeof abstractIndex !== 'number' || abstractIndex < 0) {
    throw new Error('Invalid abstract index');
  }

  if (typeof sentenceIndex !== 'number' || sentenceIndex < 0) {
    throw new Error('Invalid sentence index');
  }

  if (typeof entityIndex !== 'number') {
    throw new Error('Invalid entity index');
  }

  if (!answer) {
    throw new Error('Answer is required');
  }

  return true;
};

export default async function handler(req, res) {
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

    // Validate request data
    const { fileId, abstractIndex, sentenceIndex, entityIndex, answer } = req.body;
    validateAnnotationData(req.body);

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

    // Validate indices against file structure
    if (!file.abstracts[abstractIndex]?.sentences[sentenceIndex]) {
      throw new Error('Invalid abstract or sentence index');
    }

    if (entityIndex >= 0 && 
        !file.abstracts[abstractIndex].sentences[sentenceIndex].scientific_entities[entityIndex]) {
      throw new Error('Invalid entity index');
    }

    // Save annotation
    const annotation = await Annotation.findOneAndUpdate(
      {
        fileId,
        userId: auth.user._id,
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
      userId: auth.user._id
    }).session(session);

    const progress = Math.min((totalAnnotations * 100) / file.totalSteps, 100);
    const roundedProgress = Math.round(progress * 10) / 10;

    await File.findByIdAndUpdate(
      fileId,
      { $set: { progress: roundedProgress } },
      { session }
    );

    await session.commitTransaction();

    return res.json({
      success: true,
      annotation,
      progress: roundedProgress,
      timestamp: new Date(),
      fileId,
      totalSteps: file.totalSteps
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