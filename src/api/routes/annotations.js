// src/api/routes/annotations.js
import express from 'express';
import { Annotation } from '../../models/Annotation.js';
import { File } from '../../models/File.js';
import mongoose from 'mongoose';

const router = express.Router();

// Validation constants
const VALID_SENTENCE_TYPES = [
  'Background/Introduction',
  'Methods/Approach',
  'Results/Findings',
  'Conclusions/Implications',
  'Not sure'
];

const VALID_ENTITY_TYPES = [
  'Agent/Subject',
  'Object/Recipient',
  'Outcome/Effect',
  'Context/Condition',
  'Not sure'
];

// Validation middleware
const validateAnnotationRequest = async (req, res, next) => {
  try {
    const { fileId, abstractIndex, sentenceIndex, entityIndex, answer } = req.body;

    console.log('Validating annotation request:', {
      fileId,
      abstractIndex,
      sentenceIndex,
      entityIndex,
      answer
    });

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file ID format'
      });
    }

    // Ensure answer is properly extracted
    const answerValue = typeof answer === 'string' ? answer : answer?.entity;
    
    if (!answerValue) {
      return res.status(400).json({
        success: false,
        error: 'Invalid answer format'
      });
    }

    // Validate indices
    if (!Number.isInteger(abstractIndex) || abstractIndex < 0 ||
        !Number.isInteger(sentenceIndex) || sentenceIndex < 0 ||
        !Number.isInteger(entityIndex) || entityIndex < -1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid indices. Must be non-negative integers (except entityIndex which can be -1)'
      });
    }

    // Validate answer based on annotation type
    const validAnswers = entityIndex === -1 ? VALID_SENTENCE_TYPES : VALID_ENTITY_TYPES;
    
    console.log('Validating answer:', {
      answerValue,
      validAnswers,
      isValid: validAnswers.includes(answerValue)
    });

    if (!validAnswers.includes(answerValue)) {
      return res.status(400).json({
        success: false,
        error: `Invalid answer. Must be one of: ${validAnswers.join(', ')}`,
        details: {
          providedAnswer: answerValue,
          validAnswers,
          annotationType: entityIndex === -1 ? 'sentence' : 'entity'
        }
      });
    }

    // Add validated data to request
    req.validatedAnswer = answerValue;

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

    // Validate abstract and sentence exist
    if (!file.abstracts[abstractIndex] || 
        !file.abstracts[abstractIndex].sentences[sentenceIndex]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid abstract or sentence index'
      });
    }

    // Validate entity exists if entityIndex is provided
    if (entityIndex >= 0 && 
        !file.abstracts[abstractIndex].sentences[sentenceIndex]
            .scientific_entities[entityIndex]) {
      return res.status(400).json({
        success: false,
        error: 'Invalid entity index'
      });
    }

    // Add validated file to request
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
      const key = `${ann.abstractIndex}-${ann.sentenceIndex}-${ann.entityIndex}`;
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
    const { fileId, abstractIndex, sentenceIndex, entityIndex } = req.body;
    const answer = req.validatedAnswer;

    console.log('Creating annotation:', {
      fileId,
      abstractIndex,
      sentenceIndex,
      entityIndex,
      answer
    });

    // Save annotation
    const annotation = await Annotation.findOneAndUpdate(
      {
        userId: req.user._id,
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
    for (const ann of annotations) {
      const validAnswers = ann.entityIndex === -1 ? 
        VALID_SENTENCE_TYPES : VALID_ENTITY_TYPES;

      if (!validAnswers.includes(ann.answer)) {
        return res.status(400).json({
          success: false,
          error: `Invalid answer "${ann.answer}" for ${
            ann.entityIndex === -1 ? 'sentence' : 'entity'
          } annotation`
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
    const result = await Annotation.bulkWrite(operations, { session });

    // Calculate and update progress
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

/**
 * Helper function to calculate annotation progress
 */
async function calculateProgress(fileId, userId) {
  const [annotationCount, file] = await Promise.all([
    Annotation.countDocuments({ fileId, userId }),
    File.findById(fileId)
  ]);

  if (!file) {
    throw new Error('File not found');
  }

  const progress = Math.min((annotationCount * 100) / file.totalSteps, 100);
  return Math.round(progress * 10) / 10; // Round to 1 decimal place
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