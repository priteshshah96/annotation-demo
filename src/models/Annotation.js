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

// Simplified schema that focuses on data storage
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
    min: 0
  },
  eventIndex: {
    type: Number,
    required: true,
    min: 0
  },
  fieldPath: {
    type: String,
    required: true,
    trim: true
  },
  answer: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
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

export const Annotation = mongoose.models?.Annotation || 
  mongoose.model('Annotation', AnnotationSchema);

export default Annotation;