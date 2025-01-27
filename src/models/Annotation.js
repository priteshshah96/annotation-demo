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

const AnnotationSchema = new mongoose.Schema({
  annotationId: {
    type: String,
    required: true,
    unique: true,
    default: () => new mongoose.Types.ObjectId().toString()
  },
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
  paperIndex: { type: Number, required: true, min: 0 },
  eventIndex: { type: Number, required: true, min: 0 },
  fieldPath: { type: String, required: true, trim: true },
  answer: {
    text: String,
    span: { start: Number, end: Number }
  },
  arrayIndex: {
    type: Number,
    required: function() {
      return !AnnotationTypes.EVENT_TYPE.includes(this.fieldPath) && this.fieldPath !== 'Main Action';
    },
    default: function() {
      return AnnotationTypes.EVENT_TYPE.includes(this.fieldPath) || this.fieldPath === 'Main Action' ? undefined : 0;
    }
  },
  timestamp: { type: Date, default: Date.now }
});

AnnotationSchema.index({
  userId: 1,
  fileId: 1,
  paperIndex: 1,
  eventIndex: 1,
  fieldPath: 1,
  annotationId: 1
});

export const Annotation = mongoose.models?.Annotation || 
  mongoose.model('Annotation', AnnotationSchema);

export default Annotation;