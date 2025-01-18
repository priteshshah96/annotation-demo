import mongoose from 'mongoose';

// Define annotation types and fields - Keep as source of truth
export const AnnotationTypes = {
  EVENT_TYPE: [
    'Background/Introduction',
    'Methods/Approach',
    'Results/Findings',
    'Conclusions/Implications'
  ],
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

// Generate valid paths for validation once
const validPaths = [
  ...AnnotationTypes.EVENT_TYPE,
  'Main Action',
  ...Object.values(AnnotationTypes.ARGUMENT_FIELDS).flatMap(field =>
    typeof field === 'string' ?
      `Arguments.${field}` :
      Object.values(field).map(subfield => `Arguments.Object.${subfield}`)
  )
];

// Centralized validation functions
const validations = {
  isValidEventType: (value) => AnnotationTypes.EVENT_TYPE.includes(value),
  
  isValidMainAction: (value) => 
    typeof value === 'string' && value.trim().length > 0,
  
  isValidTextSelection: (selection) => 
    selection &&
    typeof selection.text === 'string' &&
    selection.text.trim().length > 0 &&
    typeof selection.start === 'number' &&
    typeof selection.end === 'number' &&
    selection.start >= 0 &&
    selection.end > selection.start,
    
  isValidArgumentField: (value) => {
    if (!Array.isArray(value)) return false;
    if (value.length === 0) return true;
    return value.every(selection => validations.isValidTextSelection(selection));
  },

  // Helper to check if Main Action exists for an event
  hasMainAction: async function(model, { userId, fileId, paperIndex, eventIndex }) {
    const mainAction = await model.findOne({
      userId,
      fileId,
      paperIndex,
      eventIndex,
      fieldPath: 'Main Action',
      answer: { $exists: true, $ne: '' }
    });
    return !!mainAction;
  }
};

// Define the main annotation schema
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
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not a valid integer for paperIndex'
    }
  },
  eventIndex: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} is not a valid integer for eventIndex'
    }
  },
  fieldPath: {
    type: String,
    required: [true, 'fieldPath is required and cannot be undefined'],
    validate: {
      validator: function(value) {
        return validPaths.includes(value);
      },
      message: (props) => `Invalid fieldPath: ${props.value}`
    }
  },
  answer: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
    validate: [{
      validator: async function(value) {
        // Debugging: Log the context (this)
        console.log('Validator Context (this):', this);
  
        // Handle both document and query contexts
        const fieldPath = this.fieldPath || (this._update && this._update.$set && this._update.$set.fieldPath);
  
        // Debugging: Log the resolved fieldPath
        console.log('Resolved fieldPath:', fieldPath);
  
        if (!fieldPath) {
          console.error('fieldPath is undefined or missing');
          return false;
        }
  
        // Empty values should be handled by deletion
        if (value === '' || value === null || value === undefined) {
          return false;
        }
  
        // Main Action validation
        if (fieldPath === 'Main Action') {
          return validations.isValidMainAction(value);
        }
  
        // For non-Main Action fields, check if Main Action exists
        if (fieldPath !== 'Main Action') {
          const hasMainAction = await validations.hasMainAction(
            this.constructor,
            {
              userId: this.userId || (this._update && this._update.$set && this._update.$set.userId),
              fileId: this.fileId || (this._update && this._update.$set && this._update.$set.fileId),
              paperIndex: this.paperIndex || (this._update && this._update.$set && this._update.$set.paperIndex),
              eventIndex: this.eventIndex || (this._update && this._update.$set && this._update.$set.eventIndex),
            }
          );
  
          if (!hasMainAction) {
            throw new Error('Main Action must be annotated first');
          }
        }
  
        if (validations.isValidEventType(fieldPath)) {
          return validations.isValidMainAction(value);
        }
  
        if (fieldPath.startsWith('Arguments.')) {
          return validations.isValidArgumentField(value);
        }
  
        return false;
      },
      message: function(props) {
        const fieldPath = this.fieldPath || (this._update && this._update.$set && this._update.$set.fieldPath);
        if (!fieldPath) return 'Field path is required';
  
        if (fieldPath === 'Main Action' || validations.isValidEventType(fieldPath)) {
          return `${fieldPath} requires a non-empty string value`;
        }
  
        if (fieldPath.startsWith('Arguments.')) {
          return `${fieldPath} requires valid text selections`;
        }
  
        return 'Invalid field type';
      }
    }]
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Pre-validate middleware for data normalization
AnnotationSchema.pre('validate', function(next) {
  try {
    // Debugging: Log the document before validation
    console.log('Pre-validate Document:', this);
    console.log('Pre-validate fieldPath:', this.fieldPath);

    // Normalize indices to integers
    if (this.paperIndex !== undefined) {
      this.paperIndex = Math.floor(Number(this.paperIndex));
    }
    if (this.eventIndex !== undefined) {
      this.eventIndex = Math.floor(Number(this.eventIndex));
    }
    
    // Normalize fieldPath
    if (this.fieldPath) {
      this.fieldPath = this.fieldPath.trim();
    }

    // Sort and validate argument selections
    if (this.fieldPath?.startsWith('Arguments.') && 
        Array.isArray(this.answer) && 
        this.answer.length > 0) {
      
      // Sort by start position
      this.answer.sort((a, b) => a.start - b.start);

      // Check for overlapping selections
      for (let i = 0; i < this.answer.length - 1; i++) {
        if (this.answer[i].end > this.answer[i + 1].start) {
          throw new Error('Text selections must not overlap');
        }
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Compound index for uniqueness
AnnotationSchema.index({
  userId: 1,
  fileId: 1,
  paperIndex: 1,
  eventIndex: 1,
  fieldPath: 1
}, { unique: true });

// Static method for batch operations
// Static method for batch operations
AnnotationSchema.statics.validateAndSave = async function(annotations, userId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Debugging: Log the annotations being processed
    console.log('Annotations being processed:', annotations);

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

// Export validation utilities for reuse
export const annotationValidations = validations;

// Export model
export const Annotation = mongoose.models?.Annotation || mongoose.model('Annotation', AnnotationSchema);
export default Annotation;