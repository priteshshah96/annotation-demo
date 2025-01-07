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

// Precompute valid field paths
const validPaths = [
  ...AnnotationTypes.EVENT_TYPE,
  AnnotationTypes.MAIN_ACTION,
  ...Object.values(AnnotationTypes.ARGUMENT_FIELDS).flatMap(field =>
    typeof field === 'string' ?
      `Arguments.${field}` :
      Object.values(field).map(subfield => `Arguments.Object.${subfield}`)
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
  abstractIndex: {
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
    validate: {
      validator: value => validPaths.includes(value),
      message: 'Invalid annotation field path'
    }
  },
  answer: {
    type: String,
    required: true,
    validate: {
      validator: v => v.trim().length > 0,
      message: 'Answer cannot be empty'
    }
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

AnnotationSchema.index({
  userId: 1,
  fileId: 1,
  abstractIndex: 1,
  eventIndex: 1,
  fieldPath: 1
}, { unique: true });

AnnotationSchema.statics.validateAndSave = async function (annotations, userId) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const operations = annotations.map(ann => ({
      updateOne: {
        filter: {
          userId,
          fileId: ann.fileId,
          abstractIndex: ann.abstractIndex,
          eventIndex: ann.eventIndex,
          fieldPath: ann.fieldPath
        },
        update: { $set: { answer: ann.answer } },
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
};

export const Annotation = mongoose.models?.Annotation || mongoose.model('Annotation', AnnotationSchema);
export default Annotation;