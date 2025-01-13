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

// Precompute valid field paths including full paths for object fields
const validPaths = [
  ...AnnotationTypes.EVENT_TYPE,
  AnnotationTypes.MAIN_ACTION,
  ...Object.values(AnnotationTypes.ARGUMENT_FIELDS).flatMap(field =>
    typeof field === 'string' ?
      `Arguments.${field}` :
      Object.values(field).map(subfield => `Object.${subfield}`)
  )
];

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
      // Ensure value is converted to number and is an integer
      const num = Number(v);
      if (Number.isNaN(num)) {
        throw new Error('paperIndex must be a valid number');
      }
      return Math.floor(num); // Ensure integer
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
      // Ensure value is converted to number and is an integer
      const num = Number(v);
      if (Number.isNaN(num)) {
        throw new Error('eventIndex must be a valid number');
      }
      return Math.floor(num); // Ensure integer
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
    type: String,
    required: true,
    set: function(v) {
      // Handle null/undefined and ensure string type
      return v?.toString().trim() ?? '';
    },
    validate: {
      validator: function(v) {
        return typeof v === 'string';
      },
      message: 'Answer must be a string'
    }
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Add this pre-validate middleware to ensure proper type conversion
AnnotationSchema.pre('validate', function(next) {
  try {
    // Convert indices to numbers if they exist
    if (this.paperIndex !== undefined) {
      this.paperIndex = Number(this.paperIndex);
    }
    if (this.eventIndex !== undefined) {
      this.eventIndex = Number(this.eventIndex);
    }
    
    // Ensure fieldPath is correctly formatted
    if (this.fieldPath) {
      this.fieldPath = this.fieldPath.trim();
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
    // Validate types before attempting to save
    annotations.forEach(ann => {
      if (typeof Number(ann.paperIndex) !== 'number' || Number.isNaN(Number(ann.paperIndex))) {
        throw new Error(`Invalid paperIndex: ${ann.paperIndex}`);
      }
      if (typeof Number(ann.eventIndex) !== 'number' || Number.isNaN(Number(ann.eventIndex))) {
        throw new Error(`Invalid eventIndex: ${ann.eventIndex}`);
      }
    });

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
            answer: ann.answer?.toString().trim() ?? '',
            timestamp: ann.timestamp || new Date()
          }
        },
        upsert: true
      }
    }));

    const result = await this.bulkWrite(operations, { 
      session,
      ordered: false // Continue processing even if some operations fail
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

// Create or get the model
export const Annotation = mongoose.models?.Annotation || mongoose.model('Annotation', AnnotationSchema);
export default Annotation;