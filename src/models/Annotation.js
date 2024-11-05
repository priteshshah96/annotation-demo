// src/models/Annotation.js
import mongoose from 'mongoose';

/**
 * Constants for valid annotation answers
 */
export const AnnotationAnswers = {
  SENTENCE: [
    'Background/Introduction',
    'Methods/Approach',
    'Results/Findings',
    'Conclusions/Implications',
    'Not sure'
  ],
  ENTITY: [
    'Agent/Subject',
    'Object/Recipient',
    'Outcome/Effect',
    'Context/Condition',
    'Not sure'
  ]
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
  sentenceIndex: {
    type: Number,
    required: [true, 'Sentence index is required'],
    min: [0, 'Sentence index must be non-negative'],
    validate: {
      validator: Number.isInteger,
      message: 'Sentence index must be an integer'
    }
  },
  entityIndex: {
    type: Number,
    required: [true, 'Entity index is required'],
    validate: {
      validator: function(v) {
        return Number.isInteger(v) && v >= -1;
      },
      message: 'Entity index must be -1 or a non-negative integer'
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
  },
  toObject: { virtuals: true }
});

// Pre-save middleware for validation
AnnotationSchema.pre('save', function(next) {
  const validAnswers = this.entityIndex === -1 
    ? AnnotationAnswers.SENTENCE 
    : AnnotationAnswers.ENTITY;

  if (!validAnswers.includes(this.answer)) {
    next(new Error(`Invalid ${this.entityIndex === -1 ? 'sentence' : 'entity'} annotation answer: "${this.answer}"`));
  } else {
    next();
  }
});

// Pre-findOneAndUpdate middleware for validation
AnnotationSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate();
  const entityIndex = update.$set?.entityIndex;
  const answer = update.$set?.answer;

  // Skip validation if no answer is being updated
  if (!answer) {
    return next();
  }

  // Get entity index from update or from query
  const effectiveEntityIndex = entityIndex ?? this.getQuery().entityIndex;
  
  const validAnswers = effectiveEntityIndex === -1 
    ? AnnotationAnswers.SENTENCE 
    : AnnotationAnswers.ENTITY;

  if (!validAnswers.includes(answer)) {
    next(new Error(`Invalid ${effectiveEntityIndex === -1 ? 'sentence' : 'entity'} annotation answer: "${answer}"`));
  } else {
    next();
  }
});

// Indexes
AnnotationSchema.index({ 
  userId: 1, 
  fileId: 1, 
  abstractIndex: 1, 
  sentenceIndex: 1, 
  entityIndex: 1 
}, { 
  unique: true,
  name: 'unique_annotation_index'
});

AnnotationSchema.index({ timestamp: -1 });

// Static Methods
AnnotationSchema.statics = {
  /**
   * Calculate progress for a file
   */
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
      return Math.round(progress * 10) / 10; // Round to 1 decimal place
    } catch (error) {
      console.error('Error calculating progress:', error);
      throw error;
    }
  },

  /**
   * Get all annotations for a file with formatted keys
   */
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
        const key = `${annotation.abstractIndex}-${annotation.sentenceIndex}-${annotation.entityIndex}`;
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

  /**
   * Bulk save annotations with validation
   */
  async bulkSaveAnnotations(annotations, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Pre-validate all annotations
      for (const ann of annotations) {
        if (!ann.fileId || !mongoose.Types.ObjectId.isValid(ann.fileId)) {
          throw new AnnotationError('Invalid file ID in annotations');
        }

        const validAnswers = ann.entityIndex === -1
          ? AnnotationAnswers.SENTENCE
          : AnnotationAnswers.ENTITY;

        if (!validAnswers.includes(ann.answer)) {
          throw new AnnotationError(
            `Invalid answer "${ann.answer}" for ${ann.entityIndex === -1 ? 'sentence' : 'entity'} annotation`
          );
        }

        if (!Number.isInteger(ann.abstractIndex) || ann.abstractIndex < 0 ||
            !Number.isInteger(ann.sentenceIndex) || ann.sentenceIndex < 0 ||
            !Number.isInteger(ann.entityIndex) || ann.entityIndex < -1) {
          throw new AnnotationError('Invalid indices in annotations');
        }
      }

      const operations = annotations.map(annotation => ({
        updateOne: {
          filter: {
            userId,
            fileId: annotation.fileId,
            abstractIndex: annotation.abstractIndex,
            sentenceIndex: annotation.sentenceIndex,
            entityIndex: annotation.entityIndex
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

// Instance methods
AnnotationSchema.methods = {
  /**
   * Validate a single annotation instance
   */
  async validateAnnotation() {
    const validAnswers = this.entityIndex === -1
      ? AnnotationAnswers.SENTENCE
      : AnnotationAnswers.ENTITY;

    if (!validAnswers.includes(this.answer)) {
      throw new AnnotationError(
        `Invalid answer "${this.answer}" for ${
          this.entityIndex === -1 ? 'sentence' : 'entity'
        } annotation`
      );
    }
  }
};

// Create or retrieve model
export const Annotation = mongoose.models?.Annotation || 
  mongoose.model('Annotation', AnnotationSchema);

export default Annotation;clearImmediate