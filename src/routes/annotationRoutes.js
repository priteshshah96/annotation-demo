import express from 'express';
import { Annotation } from '../models/Annotation.js';
import { File } from '../models/File.js';

const router = express.Router();

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

router.get('/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const mongoUserId = req.user._id;

    const annotations = await Annotation.find({
      fileId,
      userId: mongoUserId
    }).sort({ arrayIndex: 1 }).lean();  // Changed from index to arrayIndex

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

router.post('/', async (req, res) => {
  try {
    let { fileId, paperIndex, eventIndex, fieldPath, answer, isDelete, arrayIndex } = req.body;
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
      const query = {
        fileId,
        userId: mongoUserId,
        paperIndex,
        eventIndex,
        fieldPath
      };

      if (typeof arrayIndex === 'number') {
        query.arrayIndex = arrayIndex;
      }

      await Annotation.findOneAndDelete(query);

      // Reorder remaining annotations
      const remainingAnnotations = await Annotation.find({
        fileId,
        userId: mongoUserId,
        paperIndex,
        eventIndex,
        fieldPath,
        arrayIndex: { $gt: arrayIndex }
      }).sort({ arrayIndex: 1 });

      // Update arrayIndices
      for (const annotation of remainingAnnotations) {
        await Annotation.findByIdAndUpdate(annotation._id, {
          $inc: { arrayIndex: -1 }
        });
      }

      return res.json({ success: true });
    }

    // Get next arrayIndex for this field
    const prevAnnotation = await Annotation.findOne({
      fileId,
      userId: mongoUserId,
      paperIndex,
      eventIndex,
      fieldPath
    }).sort({ arrayIndex: -1 });

    const newArrayIndex = prevAnnotation ? prevAnnotation.arrayIndex + 1 : 0;

    const annotation = await Annotation.create({
      fileId,
      userId: mongoUserId,
      paperIndex,
      eventIndex,
      fieldPath,
      answer: processAnnotationAnswer(answer),
      arrayIndex: newArrayIndex,
      timestamp: new Date()
    });

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
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to sync annotations',
      details: error.message
    });
  }
});

// Keeping reset routes unchanged as they work with all annotations
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