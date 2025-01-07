import express from 'express';
import { File } from '../../models/File.js';
import { Annotation } from '../../models/Annotation.js';

const router = express.Router();

// Get all files or single file
router.get('/:fileId?', async (req, res) => {
  try {
    const mongoUserId = req.user._id;
    const { fileId } = req.params;

    // Get single file with annotations
    if (fileId) {
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

      // Fetch annotations for this file
      const annotations = await Annotation.find({
        fileId: file._id,
        userId: mongoUserId
      }).lean();

      // Create annotations map for easier frontend consumption
      const annotationsMap = annotations.reduce((acc, annotation) => {
        const key = `${annotation.abstractIndex}-${annotation.eventIndex}-${annotation.fieldPath}`;
        acc[key] = annotation.answer;
        return acc;
      }, {});

      // Calculate current progress
      const completedSteps = annotations.length;
      const progress = Math.min((completedSteps * 100) / file.totalSteps, 100);

      return res.json({
        success: true,
        file: {
          _id: file._id,
          name: file.name,
          abstracts: file.abstracts,
          totalSteps: file.totalSteps,
          progress: progress,
          uploadDate: file.uploadDate,
          metadata: file.metadata || {},
          annotations: annotationsMap
        }
      });
    }

    // Get all files
    const files = await File.find({ userId: mongoUserId }).sort({ uploadDate: -1 });

    const filesWithProgress = await Promise.all(files.map(async (file) => {
      const completedSteps = await Annotation.countDocuments({
        fileId: file._id,
        userId: mongoUserId
      });

      const progress = Math.min((completedSteps * 100) / file.totalSteps, 100);

      return {
        _id: file._id,
        name: file.name,
        totalSteps: file.totalSteps,
        progress,
        uploadDate: file.uploadDate,
        metadata: file.metadata || {}
      };
    }));

    res.json({
      success: true,
      files: filesWithProgress
    });

  } catch (error) {
    console.error('Files API error:', error);
    res.status(500).json({
      success: false,
      error: 'Files API Error',
      details: error.message
    });
  }
});

// Upload file endpoint
router.post('/upload', async (req, res) => {
  try {
    const { name, content, metadata } = req.body;
    const mongoUserId = req.user._id;

    if (!name || !content) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: 'Name and content are required'
      });
    }

    if (!Array.isArray(content)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file format',
        details: 'Content must be an array of abstracts'
      });
    }

    // Calculate total steps based on event structure
    const totalSteps = content.reduce((total, abstract) => {
      if (!abstract.events || !Array.isArray(abstract.events)) {
        return total;
      }
      return total + abstract.events.reduce((eventTotal, event) => {
        let steps = 0;
        
        // Count event type fields
        ['Background/Introduction', 'Methods/Approach', 'Results/Findings', 'Conclusions/Implications'].forEach(type => {
          if (event[type]) steps++;
        });

        // Count Main Action
        if (event['Main Action']) steps++;

        // Count Arguments fields
        if (event.Arguments) {
          const args = event.Arguments;
          // Basic argument fields
          ['Agent', 'Context', 'Purpose', 'Method', 'Results', 
           'Analysis', 'Challenge', 'Ethical', 'Implications', 'Contradictions']
            .forEach(field => {
              if (args[field]) steps++;
            });

          // Object fields
          if (args.Object) {
            ['Base Object', 'Base Modifier', 'Attached Object', 'Attached Modifier']
              .forEach(field => {
                if (args.Object[field]) steps++;
              });
          }
        }

        return eventTotal + steps;
      }, 0);
    }, 0);

    const newFile = new File({
      userId: mongoUserId,
      name,
      abstracts: content,
      totalSteps,
      progress: 0,
      uploadDate: new Date(),
      metadata: metadata || {}
    });

    const savedFile = await newFile.save();

    res.status(201).json({
      success: true,
      file: {
        _id: savedFile._id,
        name: savedFile.name,
        totalSteps: savedFile.totalSteps,
        progress: savedFile.progress,
        uploadDate: savedFile.uploadDate,
        metadata: savedFile.metadata
      }
    });

  } catch (error) {
    console.error('File upload error:', error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({
      success: false,
      error: 'Upload failed',
      details: error.message
    });
  }
});

// Delete file endpoint
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
        details: 'File does not exist or you do not have permission to delete it'
      });
    }

    // Delete both file and its annotations
    await Promise.all([
      File.deleteOne({ _id: fileId }),
      Annotation.deleteMany({ fileId })
    ]);

    res.json({
      success: true,
      message: 'File and related annotations deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete file',
      details: error.message
    });
  }
});

export default router;