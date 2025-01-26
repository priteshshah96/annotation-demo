import express from 'express';
import mongoose from 'mongoose';
import { Annotation } from '../models/Annotation.js';
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

const processAnnotationAnswer = (answer) => {
  if (!answer) return null;
  if (typeof answer === 'string') return { text: answer };
  if (answer.span && typeof answer.text === 'string') {
    return {
      text: answer.text,
      span: {
        start: Number(answer.span.start),
        end: Number(answer.span.end)
      }
    };
  }
  if (typeof answer.text === 'string' && 
      (typeof answer.start === 'number' || typeof answer.end === 'number')) {
    return {
      text: answer.text,
      span: {
        start: Number(answer.start),
        end: Number(answer.end)
      }
    };
  }
  return null;
};

// Wrap each route with asyncHandler
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
 
  if (!fileId || paperIndex == null || eventIndex == null || !fieldPath) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields'
    });
  }
 
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
 
  if (isDelete) {
    if (!annotationId) {
      return res.status(400).json({
        success: false,
        error: 'annotationId required for deletion'
      });
    }
 
    const annotationToDelete = await Annotation.findOne({ annotationId });
 
    if (!annotationToDelete) {
      console.log('No annotation found to delete with ID:', annotationId);
      return res.status(404).json({
        success: false,
        error: 'Annotation not found'
      });
    }
 
    await Annotation.deleteOne({ annotationId });
 
    if (fieldPath !== 'Main Action') {
      const remainingAnnotations = await Annotation.find({
        fileId,
        userId: mongoUserId,
        paperIndex,
        eventIndex, 
        fieldPath,
        arrayIndex: { $gt: annotationToDelete.arrayIndex }
      }).sort({ arrayIndex: 1 });
 
      for (let i = 0; i < remainingAnnotations.length; i++) {
        await Annotation.findByIdAndUpdate(remainingAnnotations[i]._id, {
          $set: { arrayIndex: annotationToDelete.arrayIndex + i }
        });
      }
    }
 
    return res.json({
      success: true,
      message: 'Annotation deleted successfully',
      deletedAnnotation: annotationToDelete
    });
  }
 
  let arrayIndex;
  if (fieldPath !== 'Main Action') {
    const prevAnnotation = await Annotation.findOne({
      fileId,
      userId: mongoUserId,
      paperIndex,
      eventIndex,
      fieldPath
    }).sort({ arrayIndex: -1 });
 
    arrayIndex = prevAnnotation ? prevAnnotation.arrayIndex + 1 : 0;
  }
 
  const annotation = await Annotation.create({
    annotationId: new mongoose.Types.ObjectId().toString(),
    fileId,
    userId: mongoUserId,
    paperIndex,
    eventIndex,
    fieldPath,
    answer: processAnnotationAnswer(answer),
    arrayIndex,
    timestamp: new Date()
  });
 
  res.json({
    success: true,
    annotation,
    message: 'Annotation created successfully'
  });
 }));

router.post('/:fileId/sync', asyncHandler(async (req, res) => {
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
        fieldPath: ann.fieldPath,
        arrayIndex: ann.arrayIndex || 0
      },
      update: {
        $set: {
          answer: processAnnotationAnswer(ann.answer),
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
}));

router.delete('/:fileId', asyncHandler(async (req, res) => {
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
}));

router.post('/:fileId/reset', asyncHandler(async (req, res) => {
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
}));

export default router;