import mongoose from 'mongoose';

export const AnnotationTypes = {
  EVENT_TYPE: [
    'Background/Introduction',
    'Methods/Approach',
    'Results/Findings',
    'Conclusions/Implications'
  ],
  MAIN_ACTION: 'Main Action',
  ARGUMENT_FIELDS: {
    AGENT: 'Agent',
    OBJECT: {
      BASE_OBJECT: 'Base Object',
      BASE_MODIFIER: 'Base Modifier',
      ATTACHED_OBJECT: 'Attached Object',
      ATTACHED_MODIFIER: 'Attached Modifier'
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

const validPaths = [
  ...AnnotationTypes.EVENT_TYPE,
  AnnotationTypes.MAIN_ACTION,
  ...Object.values(AnnotationTypes.ARGUMENT_FIELDS).flatMap(field =>
    typeof field === 'string' ?
      `Arguments.${field}` :
      Object.values(field).map(subfield => `Object.${subfield}`)
  )
];

// Define schema for individual text selections
const TextSelectionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  start: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: 'Start position must be an integer'
    }
  },
  end: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: 'End position must be an integer'
    }
  }
}, { _id: false });

const AnnotationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'File',
    required: true,
    index: true
  },
  paperIndex: {
    type: Number,
    required: true,
    min: 0,
    set: function(v) {
      const num = Number(v);
      if (Number.isNaN(num)) {
        throw new Error('paperIndex must be a valid number');
      }
      return Math.floor(num);
    },
    validate: {
      validator: function(v) {
        return Number.isInteger(v) && v >= 0;
      },
      message: props => `${props.value} is not a valid non-negative integer for paperIndex`
    }
  },
  eventIndex: {
    type: Number,
    required: true,
    min: 0,
    set: function(v) {
      const num = Number(v);
      if (Number.isNaN(num)) {
        throw new Error('eventIndex must be a valid number');
      }
      return Math.floor(num);
    },
    validate: {
      validator: function(v) {
        return Number.isInteger(v) && v >= 0;
      },
      message: props => `${props.value} is not a valid non-negative integer for eventIndex`
    }
  },
  fieldPath: {
    type: String,
    required: true,
    validate: {
      validator: function(value) {
        return validPaths.includes(value);
      },
      message: props => `Invalid annotation field path: ${props.value}. Valid paths are: ${validPaths.join(', ')}`
    }
  },
  answer: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    validate: {
      validator: function(v) {
        // Determine if this is an argument field
        const isArgumentField = this.fieldPath.startsWith('Arguments.') || 
                              this.fieldPath.startsWith('Object.');
        
        if (isArgumentField) {
          // For arguments, answer should be an array of text selections
          if (!Array.isArray(v)) return false;
          if (v.length === 0) return true; // Allow empty arrays
          
          // Validate each text selection in the array
          return v.every(selection => 
            selection &&
            typeof selection.text === 'string' &&
            Number.isInteger(selection.start) &&
            Number.isInteger(selection.end) &&
            selection.start >= 0 &&
            selection.end > selection.start
          );
        } else {
          // For event types and main action, answer should be a string
          return typeof v === 'string';
        }
      },
      message: 'Invalid answer format: Arguments require an array of text selections, others require a string'
    }
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Pre-validate middleware
AnnotationSchema.pre('validate', function(next) {
  try {
    // Convert indices to numbers
    if (this.paperIndex !== undefined) {
      this.paperIndex = Number(this.paperIndex);
    }
    if (this.eventIndex !== undefined) {
      this.eventIndex = Number(this.eventIndex);
    }
    
    // Format fieldPath
    if (this.fieldPath) {
      this.fieldPath = this.fieldPath.trim();
    }

    const isArgumentField = this.fieldPath.startsWith('Arguments.') || 
                          this.fieldPath.startsWith('Object.');

    if (isArgumentField && Array.isArray(this.answer) && this.answer.length > 0) {
      // Sort array by start position
      this.answer.sort((a, b) => a.start - b.start);

      // Check for overlapping selections
      for (let i = 0; i < this.answer.length - 1; i++) {
        const current = this.answer[i];
        const next = this.answer[i + 1];
        
        if (current.end > next.start) {
          throw new Error('Text selections must not overlap');
        }
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Add compound index for uniqueness
AnnotationSchema.index({
  userId: 1,
  fileId: 1,
  paperIndex: 1,
  eventIndex: 1,
  fieldPath: 1
}, { unique: true });

// Static method for batch operations
AnnotationSchema.statics.validateAndSave = async function(annotations, userId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const operations = annotations.map(ann => ({
      updateOne: {
        filter: {
          userId,
          fileId: ann.fileId,
          paperIndex: Number(ann.paperIndex),
          eventIndex: Number(ann.eventIndex),
          fieldPath: ann.fieldPath
        },
        update: { 
          $set: { 
            answer: ann.answer,
            timestamp: ann.timestamp || new Date()
          }
        },
        upsert: true
      }
    }));

    const result = await this.bulkWrite(operations, { 
      session,
      ordered: false
    });
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export const Annotation = mongoose.models?.Annotation || mongoose.model('Annotation', AnnotationSchema);
export default Annotation;