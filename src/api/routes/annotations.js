// src/api/routes/annotations.js
import express from 'express';
import { Annotation, AnnotationTypes } from '../../models/Annotation.js';
import { File } from '../../models/File.js';
import mongoose from 'mongoose';

const router = express.Router();

// Validation middleware
const validateAnnotationRequest = async (req, res, next) => {
  try {
    const { fileId, abstractIndex, eventIndex, fieldPath, answer } = req.body;

    console.log('Validating annotation request:', {
      fileId,
      abstractIndex,
      eventIndex,
      fieldPath,
      answer
    });

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file ID format'
      });
    }

    // Validate indices
    if (!Number.isInteger(abstractIndex) || abstractIndex < 0 ||
        !Number.isInteger(eventIndex) || eventIndex < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid indices. Must be non-negative integers'
      });
    }

    // Validate fieldPath
    const validPaths = [
      'Main_Action',
      ...Object.values(AnnotationTypes.ARGUMENT_FIELDS)
        .map(field => typeof field === 'string' ? 
          `Arguments.${field}` : 
          Object.values(field).map(subfield => `Arguments.Object.${subfield}`))
        .flat()
    ];

    if (!validPaths.includes(fieldPath)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid field path',
        details: `Field path must be one of: ${validPaths.join(', ')}`
      });
    }

    // Validate file exists and belongs to user
    const file = await File.findOne({ 
      _id: fileId,
      userId: req.user._id 
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        error: 'File not found or access denied'
      });
    }

    // Validate abstract and event exist
    if (!file.abstracts[abstractIndex] || 
        !file.abstracts[abstractIndex].events[eventIndex]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid abstract or event index'
      });
    }

    // Add validated data to request
    req.validatedAnnotation = {
      fileId,
      abstractIndex,
      eventIndex,
      fieldPath,
      answer
    };
    req.validatedFile = file;
    next();
  } catch (error) {
    console.error('Validation error:', error);
    next(error);
  }
};

/**
 * GET /:fileId - Get all annotations for a file
 */
router.get('/:fileId', async (req, res, next) => {
  try {
    const { fileId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file ID format'
      });
    }

    // Get annotations with progress in parallel
    const [annotations, progress] = await Promise.all([
      Annotation.find({ 
        fileId,
        userId: req.user._id 
      }).sort({ timestamp: -1 }),
      calculateProgress(fileId, req.user._id)
    ]);

    // Format annotations for response
    const formattedAnnotations = annotations.reduce((acc, ann) => {
      const key = `${ann.abstractIndex}-${ann.eventIndex}-${ann.fieldPath}`;
      acc[key] = {
        answer: ann.answer,
        timestamp: ann.timestamp
      };
      return acc;
    }, {});

    res.json({
      success: true,
      annotations: formattedAnnotations,
      progress,
      timestamp: new Date()
    });

  } catch (error) {
    next(error);
  }
});

/**
 * POST / - Save single annotation
 */
router.post('/', validateAnnotationRequest, async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { fileId, abstractIndex, eventIndex, fieldPath, answer } = req.validatedAnnotation;

    console.log('Creating annotation:', {
      fileId,
      abstractIndex,
      eventIndex,
      fieldPath,
      answer
    });

    // Save annotation
    const annotation = await Annotation.findOneAndUpdate(
      {
        userId: req.user._id,
        fileId,
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
        upsert: true, 
        new: true,
        session,
        runValidators: true
      }
    );

    // Calculate new progress
    const progress = await calculateProgress(fileId, req.user._id);

    // Update file progress
    await File.findByIdAndUpdate(
      fileId,
      { $set: { progress } },
      { session }
    );

    await session.commitTransaction();

    res.json({
      success: true,
      annotation,
      progress,
      timestamp: new Date()
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error saving annotation:', error);
    next(error);
  } finally {
    session.endSession();
  }
});

/**
 * POST /:fileId/sync - Bulk sync annotations
 */
router.post('/:fileId/sync', async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { fileId } = req.params;
    const { annotations } = req.body;

    if (!Array.isArray(annotations) || annotations.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Annotations must be a non-empty array'
      });
    }

    // Validate all annotations before processing
    const validPaths = [
      'Main_Action',
      ...Object.values(AnnotationTypes.ARGUMENT_FIELDS)
        .map(field => typeof field === 'string' ? 
          `Arguments.${field}` : 
          Object.values(field).map(subfield => `Arguments.Object.${subfield}`))
        .flat()
    ];

    for (const ann of annotations) {
      if (!validPaths.includes(ann.fieldPath)) {
        return res.status(400).json({
          success: false,
          error: `Invalid field path "${ann.fieldPath}"`,
          details: `Field path must be one of: ${validPaths.join(', ')}`
        });
      }
    }

    // Prepare bulk operations
    const operations = annotations.map(ann => ({
      updateOne: {
        filter: {
          userId: req.user._id,
          fileId,
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

    const result = await Annotation.bulkWrite(operations, { session });
    const progress = await calculateProgress(fileId, req.user._id);
    
    await File.findByIdAndUpdate(
      fileId,
      { $set: { progress } },
      { session }
    );

    await session.commitTransaction();

    res.json({
      success: true,
      result,
      progress,
      timestamp: new Date()
    });

  } catch (error) {
    await session.abortTransaction();
    next(error);
  } finally {
    session.endSession();
  }
});

// Helper function remains the same
async function calculateProgress(fileId, userId) {
  const [annotationCount, file] = await Promise.all([
    Annotation.countDocuments({ fileId, userId }),
    File.findById(fileId)
  ]);

  if (!file) {
    throw new Error('File not found');
  }

  const progress = Math.min((annotationCount * 100) / file.totalSteps, 100);
  return Math.round(progress * 10) / 10;
}

/**
 * Error handling middleware
 */
router.use((error, req, res, next) => {
  console.error('Annotation API Error:', error);
  
  // Handle known error types
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: Object.values(error.errors).map(err => err.message)
    });
  }

  if (error.name === 'MongoError' && error.code === 11000) {
    return res.status(409).json({
      success: false,
      error: 'Duplicate annotation',
      details: 'An annotation for this item already exists'
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

export default router;