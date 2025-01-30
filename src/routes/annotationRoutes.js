import express from 'express';
import mongoose from 'mongoose';
import { Annotation, AnnotationTypes } from '../models/Annotation.js';
import { File } from '../models/File.js';

const router = express.Router();
console.log('Setting up annotation routes');

// Log middleware stack when routes are being set up
router.stack?.forEach(middleware => {
    console.log(`Registered route: ${middleware.route?.path}`);
});

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Process annotation answer
const processAnnotationAnswer = (answer) => {
  // If empty/null/undefined, return null to trigger deletion
  if (!answer || (typeof answer === 'string' && !answer.trim())) {
    return null;
  }

  // For string input (like summaries/event types)
  if (typeof answer === 'string') {
    const trimmed = answer.trim();
    return trimmed ? { text: trimmed } : null;
  }

  // For object with text property (annotations with spans)
  if (answer.text !== undefined) {
    const trimmed = typeof answer.text === 'string' ? answer.text.trim() : '';
    if (!trimmed) return null;

    // With span info for annotation-type fields
    if (answer.span) {
      return {
        text: trimmed,
        span: {
          start: Number(answer.span.start),
          end: Number(answer.span.end)
        }
      };
    }

    // Just return text for regular fields
    return { text: trimmed };
  }

  // For object with start/end but no span property
  if (typeof answer.start === 'number' && typeof answer.end === 'number' && answer.text) {
    return {
      text: answer.text.trim(),
      span: {
        start: Number(answer.start),
        end: Number(answer.end)
      }
    };
  }

  return null;
};

// Get annotations for a file
router.get('/:fileId', asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  const mongoUserId = req.user._id;

  const annotations = await Annotation.find({
    fileId,
    userId: mongoUserId
  }).sort({ arrayIndex: 1 }).lean();

  res.json({
    success: true,
    annotations,
    progress: null,
    timestamp: new Date().toISOString()
  });
}));

// Create, update, or delete annotation
router.post('/', asyncHandler(async (req, res) => {
  console.log('POST route hit:', {
    body: req.body,
    path: req.path,
    method: req.method
  });
 
  let { fileId, paperIndex, eventIndex, fieldPath, answer, isDelete, annotationId } = req.body;
  const mongoUserId = req.user._id;
 
  paperIndex = Number(paperIndex);
  eventIndex = Number(eventIndex);
 
  // Input validation
  if (!fileId || paperIndex == null || eventIndex == null || !fieldPath) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields'
    });
  }
 
  // Check file exists and belongs to user
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
 
  if (!file.papers[paperIndex]?.events[eventIndex]) {
    return res.status(400).json({
      success: false,
      error: 'Invalid paper or event index'
    });
  }

  // Process the answer
  const processedAnswer = processAnnotationAnswer(answer);

  // Check for existing annotation
  const existingAnnotation = await Annotation.findOne({
    fileId,
    userId: mongoUserId,
    paperIndex,
    eventIndex,
    fieldPath
  });

  // Handle deletion cases (explicit delete or null processed answer)
  if (isDelete || processedAnswer === null) {
    if (existingAnnotation) {
      await Annotation.deleteOne({ _id: existingAnnotation._id });
      return res.json({
        success: true,
        message: 'Annotation deleted successfully',
        deletedAnnotation: existingAnnotation
      });
    }
    return res.json({
      success: true,
      message: 'No annotation to delete'
    });
  }

  // If annotation exists, update it
  if (existingAnnotation) {
    const updatedAnnotation = await Annotation.findByIdAndUpdate(
      existingAnnotation._id,
      {
        $set: {
          answer: processedAnswer,
          timestamp: new Date()
        }
      },
      { new: true }
    );

    return res.json({
      success: true,
      annotation: updatedAnnotation,
      message: 'Annotation updated successfully'
    });
  }

  // If no existing annotation, create new one
  let arrayIndex;
  // Only set arrayIndex for non-event types and non-main action
  if (!AnnotationTypes.EVENT_TYPE.includes(fieldPath) && fieldPath !== AnnotationTypes.MAIN_ACTION) {
    const prevAnnotation = await Annotation.findOne({
      fileId,
      userId: mongoUserId,
      paperIndex,
      eventIndex,
      fieldPath
    }).sort({ arrayIndex: -1 });

    arrayIndex = prevAnnotation ? prevAnnotation.arrayIndex + 1 : 0;
  }
 
  const newAnnotation = await Annotation.create({
    annotationId: new mongoose.Types.ObjectId().toString(),
    fileId,
    userId: mongoUserId,
    paperIndex,
    eventIndex,
    fieldPath,
    answer: processedAnswer,
    arrayIndex,
    timestamp: new Date()
  });
 
  res.json({
    success: true,
    annotation: newAnnotation,
    message: 'Annotation created successfully'
  });
}));

// Sync annotations
router.post('/:fileId/sync', asyncHandler(async (req, res) => {
  const { fileId } = req.params;
  const { annotations = [] } = req.body;
  const mongoUserId = req.user._id;

  const operations = annotations.map(ann => {
    const processedAnswer = processAnnotationAnswer(ann.answer);
    
    // If processed answer is null, we should delete instead of update
    if (processedAnswer === null) {
      return {
        deleteOne: {
          filter: {
            fileId,
            userId: mongoUserId,
            paperIndex: ann.paperIndex,
            eventIndex: ann.eventIndex,
            fieldPath: ann.fieldPath
          }
        }
      };
    }

    return {
      updateOne: {
        filter: {
          fileId,
          userId: mongoUserId,
          paperIndex: ann.paperIndex,
          eventIndex: ann.eventIndex,
          fieldPath: ann.fieldPath,
          arrayIndex: ann.arrayIndex || 0
        },
        update: {
          $set: {
            answer: processedAnswer,
            timestamp: new Date(ann.timestamp || Date.now())
          }
        },
        upsert: true
      }
    };
  });

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
}));


// Reset annotations for a file
router.post('/:fileId/reset', asyncHandler(async (req, res) => {
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

  // Delete all annotations for this file
  await Annotation.deleteMany({
    fileId,
    userId: mongoUserId
  });

  // Reset file progress
  await File.findByIdAndUpdate(fileId, {
    $set: { progress: 0 }
  });

  // Return success with fresh progress
  res.json({
    success: true,
    message: 'All annotations reset successfully',
    progress: 0
  });
}));

export default router;