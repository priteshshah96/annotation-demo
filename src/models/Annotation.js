// src/models/Annotation.js
import mongoose from 'mongoose';

/**
 * Constants for valid annotation answers
 */
export const AnnotationTypes = {
  EVENT_TYPE: [
    'Background/Introduction',
    'Methods/Approach',
    'Results/Findings',
    'Conclusions/Implications'
  ],
  MAIN_ACTION: 'main_action',
  ARGUMENT_FIELDS: {
    AGENT: 'Agent',
    OBJECT: {
      BASE_OBJECT: 'Base_Object',
      BASE_MODIFIER: 'Base_Modifier',
      ATTACHED_OBJECT: 'Attached_Object',
      ATTACHED_MODIFIER: 'Attached_Modifier'
    },
    CONTEXT: 'Context',
    PURPOSE: 'Purpose',
    METHOD: 'Method',
    RESULTS: 'Results',
    ANALYSIS: 'Analysis',
    CHALLENGE: 'Challenge',
    ETHICAL: 'Ethical',
    IMPLICATIONS: 'Implications',
    CONTRADICTIONS: 'Contradictions'
  }
};

/**
 * Custom error class for annotation validation
 */
export class AnnotationError extends Error {
  constructor(message, code = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'AnnotationError';
    this.code = code;
  }
}

const AnnotationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true
  },
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: [true, 'File ID is required'],
    index: true
  },
  abstractIndex: {
    type: Number,
    required: [true, 'Abstract index is required'],
    min: [0, 'Abstract index must be non-negative'],
    validate: {
      validator: Number.isInteger,
      message: 'Abstract index must be an integer'
    }
  },
  eventIndex: {
    type: Number,
    required: [true, 'Event index is required'],
    min: [0, 'Event index must be non-negative'],
    validate: {
      validator: Number.isInteger,
      message: 'Event index must be an integer'
    }
  },
  fieldPath: {
    type: String,
    required: [true, 'Field path is required'],
    validate: {
      validator: function(value) {
        // Check if it's a valid field path (e.g., "Main_Action" or "Arguments.Agent")
        const validPaths = [
          'Main_Action',
          ...Object.values(AnnotationTypes.ARGUMENT_FIELDS)
            .map(field => typeof field === 'string' ? `Arguments.${field}` : 
              Object.values(field).map(subfield => `Arguments.Object.${subfield}`))
            .flat()
        ];
        return validPaths.includes(value);
      },
      message: 'Invalid field path'
    }
  },
  answer: {
    type: String,
    required: [true, 'Answer is required']
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret.__v;
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  }
});

// Indexes
AnnotationSchema.index({ 
  userId: 1, 
  fileId: 1, 
  abstractIndex: 1, 
  eventIndex: 1,
  fieldPath: 1
}, { 
  unique: true,
  name: 'unique_annotation_index'
});

// Static Methods
AnnotationSchema.statics = {
  async getProgress(fileId, userId) {
    try {
      const [annotations, file] = await Promise.all([
        this.countDocuments({ fileId, userId }),
        mongoose.model('File').findById(fileId)
      ]);

      if (!file) {
        throw new AnnotationError('File not found', 'FILE_NOT_FOUND');
      }

      const progress = Math.min((annotations * 100) / file.totalSteps, 100);
      return Math.round(progress * 10) / 10;
    } catch (error) {
      console.error('Error calculating progress:', error);
      throw error;
    }
  },

  async getFileAnnotations(fileId, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(fileId)) {
        throw new AnnotationError('Invalid file ID', 'INVALID_ID');
      }

      const annotations = await this.find({ 
        fileId, 
        userId 
      }).sort({ timestamp: -1 });

      return annotations.reduce((acc, annotation) => {
        const key = `${annotation.abstractIndex}-${annotation.eventIndex}-${annotation.fieldPath}`;
        acc[key] = {
          answer: annotation.answer,
          timestamp: annotation.timestamp
        };
        return acc;
      }, {});
    } catch (error) {
      console.error('Error getting file annotations:', error);
      throw error;
    }
  },

  async bulkSaveAnnotations(annotations, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const operations = annotations.map(annotation => ({
        updateOne: {
          filter: {
            userId,
            fileId: annotation.fileId,
            abstractIndex: annotation.abstractIndex,
            eventIndex: annotation.eventIndex,
            fieldPath: annotation.fieldPath
          },
          update: {
            $set: {
              answer: annotation.answer,
              timestamp: new Date(annotation.timestamp || Date.now())
            }
          },
          upsert: true
        }
      }));

      const result = await this.bulkWrite(operations, { session });
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }
};

export const Annotation = mongoose.models?.Annotation || 
  mongoose.model('Annotation', AnnotationSchema);

export default Annotation;