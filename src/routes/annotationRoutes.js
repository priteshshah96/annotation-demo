import express from 'express';
import { Annotation } from '../models/Annotation.js';
import { File } from '../models/File.js';
import { processAnnotationAnswer, validateAnnotationFields, hasOverlappingSpans } from '../utils/annotationUtils.js';

const router = express.Router();

// Get annotations for a file
router.get('/:fileId', async (req, res) => {
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
router.post('/', async (req, res) => {
  try {
    let { fileId, paperIndex, eventIndex, fieldPath, answer, isDelete } = req.body;
    console.log('Received annotation save request:', {
      fileId, paperIndex, eventIndex, fieldPath, answer, isDelete
    });

    const mongoUserId = req.user._id;

    // Convert indices to numbers
    paperIndex = Number(paperIndex);
    eventIndex = Number(eventIndex);

    // Validate basic fields
    const validationErrors = validateAnnotationFields(fileId, paperIndex, eventIndex, fieldPath);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: validationErrors
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

    // Process and validate the annotation answer
    let processedAnswer;
    try {
      processedAnswer = processAnnotationAnswer(fieldPath, answer);
      
      // Check for overlapping spans if spans exist
      if (processedAnswer.spans && hasOverlappingSpans(processedAnswer.spans)) {
        return res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: 'Spans cannot overlap'
        });
      }
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details: error.message
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
        upsert: true
      }
    );

    console.log('Saved annotation:', annotation);

    res.json({
      success: true,
      annotation
    });

  } catch (error) {
    console.error('Annotation save error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save annotation',
      details: error.message
    });
  }
});

// Delete annotations for a file
router.delete('/:fileId', async (req, res) => {
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
router.post('/:fileId/sync', async (req, res) => {
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
router.post('/:fileId/reset', async (req, res) => {
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

export default router;